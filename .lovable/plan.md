

# Incluir Agendamentos de Dominio Externo na pagina de Agendamentos

## Problema

A pagina de Agendamentos (`/schedules`) consulta apenas a tabela `analysis_schedules` (firewalls). Os agendamentos de dominios externos ficam na tabela `external_domain_schedules` e nao sao exibidos.

## Solucao

Unificar as duas fontes de dados em uma unica lista, adicionando uma coluna "Tipo" para diferenciar Firewall de Dominio Externo.

## Alteracoes

### Arquivo: `src/pages/admin/SchedulesPage.tsx`

1. **Nova query para buscar `external_domain_schedules`** com join em `external_domains` e `clients`, no mesmo formato da query de firewalls

2. **Unificar os dados** em um tipo normalizado (ex: `UnifiedSchedule`) com campos comuns:
   - `id`, `targetId`, `targetName`, `targetType` ("firewall" | "external_domain")
   - `frequency`, `isActive`, `nextRunAt`, `scheduledHour`, `scheduledDayOfWeek`, `scheduledDayOfMonth`
   - `clientId`, `clientName`, `lastScore`

3. **Atualizar a query de `latestTasks`** para buscar tarefas tanto de `target_type = 'firewall'` quanto `target_type = 'external_domain'`

4. **Adicionar coluna "Tipo" na tabela** com badge visual diferenciando:
   - Firewall: badge com icone Shield
   - Dominio Externo: badge com icone Globe

5. **Atualizar filtros e stats** para considerar ambos os tipos

6. **Atualizar filtro de busca** para buscar por nome em ambos os tipos

7. **Atualizar placeholder** do campo de busca de "Buscar firewall..." para "Buscar ativo..."

Nenhum outro arquivo precisa ser modificado. Nenhuma migracao de banco necessaria.

