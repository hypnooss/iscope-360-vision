

## Bug: Timeline do Firewall Compliance mostra execuções do Analyzer

### Causa raiz

Tanto o **Firewall Compliance** (`fortigate_compliance`) quanto o **Firewall Analyzer** (`fortigate_analyzer`) criam tasks em `agent_tasks` com **o mesmo `target_id`** (firewall_id) e **o mesmo `target_type`** (`firewall`). A diferença está apenas no campo `task_type`.

A query `taskHistory` (linha 442) busca tasks filtrando **apenas por `target_id`**, sem filtrar por `task_type`. Resultado: ao expandir um agendamento de Firewall Compliance (diário), a timeline mostra **todas** as tasks daquele firewall, incluindo as do Analyzer (que roda de hora em hora). Daí a impressão de que o Compliance roda a cada hora.

### Correção

1. **Incluir `task_type` na query de `taskHistory`** (linha 442-448): adicionar `.select(... task_type ...)` para trazer o campo `task_type` no resultado.

2. **Filtrar no `ScheduleTimeline`** (linha 733): ao passar tasks para o componente, filtrar não só por `target_id` mas também pelo `task_type` correspondente ao `targetType` do schedule. Usar o mapeamento inverso de `TASK_TYPE_TO_TARGET`:
   - `firewall` → filtrar `task_type = 'fortigate_compliance'`
   - `firewall_analyzer` → filtrar `task_type = 'fortigate_analyzer'`
   - `external_domain` → filtrar `task_type = 'external_domain_compliance'`
   - etc.

3. **Mesma correção na aba Execuções** (linha 1078-1090): a query `execTaskHistory` tem o mesmo problema.

4. **Corrigir também a query `latestTasks`** (linha 418-432): ela também não filtra por `task_type`, podendo mostrar o status errado (ex: status do Analyzer ao lado do Compliance).

### Impacto

Corrige a timeline para mostrar apenas as execuções do tipo correto de análise. A frequência no banco está correta — o problema é puramente de exibição.

