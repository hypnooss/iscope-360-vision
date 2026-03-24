

## Plano: Priorizar Python do SCL via PATH e seleção por versão

### Diagnóstico
O problema não é só “encontrar” o Python do SCL. Hoje os scripts:

- verificam primeiro `python3` no `PATH`
- só depois tentam o caminho absoluto do SCL
- no `agent-fix`, nem validam a versão mínima antes de criar o venv

No CentOS 7 isso é perigoso, porque pode existir um `python3` antigo no `PATH` e ele acaba sendo escolhido antes do Python 3.8 do SCL. Isso explica por que o erro continuou mesmo após instalar `rh-python38`.

### Melhor abordagem
Sim: faz sentido ajustar o `PATH`, mas não como solução isolada. O ideal é combinar 3 coisas:

1. **Pré-adicionar paths SCL conhecidos ao `PATH`**
2. **Escolher o Python pela versão real**, não só pelo nome do binário
3. **Validar e logar explicitamente qual Python/version foi selecionado**

### O que será alterado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-fix/index.ts` | Inserir paths SCL no `PATH`, selecionar Python compatível e validar versão antes do venv |
| `supabase/functions/agent-install/index.ts` | Mesmo ajuste para instalação nova |
| `supabase/functions/super-agent-install/index.ts` | Mesmo ajuste para super-agent |
| `python-agent/requirements.txt` | Revisar se o mínimo real exige `>=3.8` ou `>=3.9`, para alinhar com os scripts |

### Estratégia de implementação
1. Criar uma rotina para **prepend** no `PATH` destes diretórios, se existirem:
   - `/opt/rh/rh-python311/root/usr/bin`
   - `/opt/rh/rh-python39/root/usr/bin`
   - `/opt/rh/rh-python38/root/usr/bin`

2. Refatorar `choose_python()` para:
   - testar cada candidato
   - ler a versão real (`major.minor`)
   - aceitar apenas versões compatíveis
   - preferir a mais nova compatível

3. No `agent-fix`, adicionar a mesma validação que já existe nos instaladores, para impedir recriar o venv com Python antigo.

4. Melhorar os logs para mostrar algo como:
   - caminho do binário escolhido
   - versão detectada
   - motivo da rejeição de binários antigos

### Resultado esperado
Após o ajuste, em CentOS 7 com `rh-python38` instalado, o script deve usar o Python do SCL automaticamente, sem depender de `scl enable`, e sem cair no `python3` antigo do sistema.

## Detalhe técnico
Hoje a ordem de seleção favorece o primeiro `python3` encontrado no ambiente. O plano corrige isso mudando a lógica de “achar um executável” para “achar um executável compatível”.

Fluxo esperado:

```text
1. Adiciona binários SCL ao PATH
2. Testa python3.11 / 3.10 / 3.9 / 3.8 / python3
3. Lê a versão real de cada um
4. Ignora os incompatíveis
5. Usa o melhor compatível
6. Só então cria o venv e instala requirements
```

### Observação importante
Se o projeto realmente suporta Python 3.8, os scripts não devem continuar exigindo `>=3.9`, senão o `agent-install` e `super-agent-install` ainda poderão falhar mesmo com o SCL funcionando. Por isso a revisão do requisito mínimo precisa ser feita junto.

