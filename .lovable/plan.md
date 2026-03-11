# Status: ✅ Implementado

## Centralização de Timezone — America/Sao_Paulo (UTC-3)

### Problema resolvido
Todas as datas do sistema agora são exibidas no fuso **America/Sao_Paulo**, independente do fuso do browser do usuário. O agendamento também converte corretamente a hora selecionada (BRT) para UTC.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| `src/lib/dateUtils.ts` | Novo arquivo com helpers centralizados (`formatDateTimeBR`, `formatDateTimeFullBR`, `formatShortDateTimeBR`, `formatDateOnlyBR`, `formatDateLongBR`, `formatDateTimeLongBR`, `formatDateTimeMediumBR`, `toBRT`) |
| `ScheduleDialog.tsx` | `calculateNextRun` converte hora BRT→UTC; label simplificado |
| `run-scheduled-analyses` Edge Function | `calculateNextRunAt` converte hora BRT→UTC; suporta `next_run_at` NULL para recálculo sem disparo |
| ~30 arquivos .tsx | Todas as chamadas `toLocaleString('pt-BR')` e `format(new Date(...))` substituídas por helpers com timezone fixo |

## Correção de Dados — scheduled_hour UTC→BRT

### Problema resolvido
Os valores `scheduled_hour` existentes nas tabelas de agendamento estavam em UTC (sistema antigo). Com a correção de timezone, passaram a ser interpretados como BRT, causando deslocamento de +3h.

### Solução aplicada
1. **Migration**: Subtraiu 3h de todos os `scheduled_hour` em 6 tabelas (`analysis_schedules`, `analyzer_schedules`, `m365_compliance_schedules`, `m365_analyzer_schedules`, `attack_surface_schedules`, `external_domain_schedules`)
2. **Edge Function**: Adicionado suporte a `next_run_at IS NULL` — recalcula sem disparar análise
3. **Recálculo**: Todos os `next_run_at` foram recalculados corretamente
