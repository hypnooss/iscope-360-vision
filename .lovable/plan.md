# Status: ✅ Implementado

## Centralização de Timezone — America/Sao_Paulo (UTC-3)

### Problema resolvido
Todas as datas do sistema agora são exibidas no fuso **America/Sao_Paulo**, independente do fuso do browser do usuário. O agendamento também converte corretamente a hora selecionada (BRT) para UTC.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| `src/lib/dateUtils.ts` | Novo arquivo com helpers centralizados (`formatDateTimeBR`, `formatDateTimeFullBR`, `formatShortDateTimeBR`, `formatDateOnlyBR`, `formatDateLongBR`, `formatDateTimeLongBR`, `formatDateTimeMediumBR`, `toBRT`) |
| `ScheduleDialog.tsx` | `calculateNextRun` converte hora BRT→UTC; label simplificado |
| `run-scheduled-analyses` Edge Function | `calculateNextRunAt` converte hora BRT→UTC |
| ~30 arquivos .tsx | Todas as chamadas `toLocaleString('pt-BR')` e `format(new Date(...))` substituídas por helpers com timezone fixo |
