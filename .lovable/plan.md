

# Renomear task_type `firewall_analyzer` para `fortigate_analyzer`

## Resumo

O tipo de tarefa `firewall_analyzer` sera renomeado para `fortigate_analyzer` para manter consistencia com o padrao existente (`fortigate_compliance`). A mudanca envolve o enum do banco de dados, a funcao RPC, edge functions e tipos do frontend.

## Detalhes tecnicos

### 1. Migracao SQL

Criar uma migracao que:
- Adiciona o valor `fortigate_analyzer` ao enum `agent_task_type`
- Atualiza todos os registros existentes de `firewall_analyzer` para `fortigate_analyzer`
- Atualiza a funcao RPC `rpc_get_agent_tasks` para referenciar `fortigate_analyzer` no `CASE WHEN`

Nota: Nao e possivel remover valores de um enum PostgreSQL sem recriar o tipo, entao o valor antigo permanecera no enum mas nao sera mais utilizado.

### 2. Edge Functions

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Trocar todas as referencias `firewall_analyzer` por `fortigate_analyzer` (task_type em queries e insert) |
| `supabase/functions/agent-task-result/index.ts` | Trocar comparacao `task.task_type === 'firewall_analyzer'` por `'fortigate_analyzer'` e logs |

### 3. Frontend

| Arquivo | Mudanca |
|---|---|
| `src/integrations/supabase/types.ts` | Adicionar `fortigate_analyzer` ao enum e manter `firewall_analyzer` para compatibilidade |

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `supabase/migrations/[timestamp].sql` | Criar - adicionar enum value + UPDATE registros + atualizar RPC |
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Modificar - 4 ocorrencias |
| `supabase/functions/agent-task-result/index.ts` | Modificar - 5 ocorrencias |
| `src/integrations/supabase/types.ts` | Modificar - adicionar novo valor ao enum |

