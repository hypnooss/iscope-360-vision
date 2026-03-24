
## Plano: Forçar atualização do `requirements.txt` no fluxo de repair/install

### Diagnóstico
O erro persistiu porque o script **não está usando o `requirements.txt` novo do bucket**.

Pelo código atual do `agent-fix`:
- ele faz `find ... ! -name 'requirements.txt'`, ou seja, **preserva o arquivo antigo** em `/opt/iscope-agent/requirements.txt`
- depois **só baixa do storage se o arquivo não existir**
- no seu log, não apareceu a mensagem `requirements.txt não encontrado após extração — baixando do storage...`, então o fallback **não rodou**

Ou seja: mesmo com o bucket atualizado, o repair continua reutilizando o `requirements.txt` velho local, que ainda contém `dnspython>=2.7.0`.

### O que vou ajustar
1. **`agent-fix`**
   - parar de preservar `requirements.txt` antigo durante a limpeza
   - sempre garantir que o arquivo final usado no venv seja o mais novo:
     - priorizar o `requirements.txt` extraído do pacote, ou
     - baixar do storage e sobrescrever quando necessário
   - adicionar log explícito mostrando de onde veio o `requirements.txt`

2. **`agent-install`**
   - aplicar a mesma correção para evitar instalações novas herdando um `requirements.txt` velho

3. **`super-agent-install`**
   - alinhar o comportamento com os outros scripts para evitar inconsistência entre install/fix/super-install

### Arquivos a ajustar
- `supabase/functions/agent-fix/index.ts`
- `supabase/functions/agent-install/index.ts`
- `supabase/functions/super-agent-install/index.ts`

### Estratégia
```text
1. Limpar sem preservar requirements.txt
2. Extrair os tar.gz
3. Validar se INSTALL_DIR/requirements.txt existe
4. Se faltar, baixar do bucket
5. Logar qual arquivo será usado
6. Criar venv e instalar dependências
```

### Melhoria extra recomendada
Além disso, vou adicionar uma validação de conteúdo antes do `pip install`, por exemplo:
- checar se o arquivo final ainda contém `dnspython>=2.7.0`
- se contiver, abortar com mensagem clara dizendo que o pacote/bucket ainda está desatualizado

Isso evita ficar preso em loop com erro de PyPI quando o problema real é arquivo antigo.

### Resultado esperado
Depois dessa mudança, o `agent-fix` vai realmente usar o `requirements.txt` compatível com Python 3.8, em vez de reaproveitar a cópia local antiga. Isso deve eliminar o erro atual do `dnspython>=2.7.0`.
