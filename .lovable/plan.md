

## Plano: Forçar atualização do requirements.txt no fluxo de repair/install

### Status: ✅ Implementado

### Mudanças realizadas

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-fix/index.ts` | Removido `! -name 'requirements.txt'` do find; agora sempre baixa fresh do storage e valida conteúdo |
| `supabase/functions/agent-install/index.ts` | Removido `! -name 'requirements.txt'` dos dois blocos de limpeza (offline e online) |
| `python-agent/requirements.txt` | `dnspython>=2.4.0,<2.7.0` (já alterado anteriormente) |

### Comportamento atual do agent-fix
1. Limpa tudo exceto venv, .env, storage, logs (requirements.txt **não é mais preservado**)
2. Extrai os tar.gz
3. **Sempre baixa requirements.txt fresco do storage** (sobrescreve qualquer versão local)
4. Se falhar o download, usa o extraído do pacote como fallback
5. **Valida** que o arquivo não contém `dnspython>=2.7` antes de criar o venv
6. Cria venv e instala dependências
