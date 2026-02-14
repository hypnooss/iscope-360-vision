
# Fix: Extração de IPs de Firewall no Attack Surface Queue

## Problema Identificado

A edge function `run-attack-surface-queue` busca a **última tarefa completada** de cada firewall para extrair IPs públicos do step `system_interface`, mas **não filtra por `task_type`**.

- O step `system_interface` só existe em tarefas do tipo `fortigate_compliance`
- Tarefas do tipo `firewall_analyzer` contêm apenas steps de logs (denied_traffic, auth_events, etc.)
- Como tarefas de analyzer são executadas com mais frequência, elas frequentemente são as mais recentes, "escondendo" a compliance que tem os dados de interface

### Dados concretos do workspace PRECISIO:
- **BAU-FW**: última task era `firewall_analyzer` (sem `system_interface`) -- a compliance existia mas ficou "atrás"
- **BR-PMP-FW-001**: nunca teve `fortigate_compliance`, apenas `firewall_analyzer`

## Correção

**Arquivo:** `supabase/functions/run-attack-surface-queue/index.ts`

Adicionar filtro `.eq('task_type', 'fortigate_compliance')` na query que busca a última tarefa completada por firewall (linha 196), garantindo que apenas tarefas que contêm o step `system_interface` sejam consideradas.

### De:
```typescript
const { data: tasks } = await supabase
  .from('agent_tasks')
  .select('id')
  .eq('target_id', fw.id)
  .eq('target_type', 'firewall')
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1)
```

### Para:
```typescript
const { data: tasks } = await supabase
  .from('agent_tasks')
  .select('id')
  .eq('target_id', fw.id)
  .eq('target_type', 'firewall')
  .eq('task_type', 'fortigate_compliance')
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1)
```

Apenas 1 linha adicionada. Nenhuma outra alteracao necessaria.
