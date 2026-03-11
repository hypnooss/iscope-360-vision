

## Plano: Centralizar todas as datas no fuso UTC-3 (America/Sao_Paulo)

### Problema

O sistema tem dois problemas de timezone:

1. **Exibição**: Todas as chamadas `toLocaleString('pt-BR')` e `format(...)` usam o fuso do navegador do usuário, sem forçar `America/Sao_Paulo`. Se o usuário estiver em outro fuso, os horários ficam errados.

2. **Agendamento**: O `ScheduleDialog` usa `setHours(hour)` (hora local do browser), mas o `run-scheduled-analyses` usa `Date.UTC(..., hour, ...)` tratando a hora como UTC. Resultado: se o usuário seleciona "15:00 (UTC-3)", o cron executa às 15:00 UTC = 12:00 BRT.

### Solução

#### 1. Criar `src/lib/dateUtils.ts` — utilidade centralizada

Funções helper que sempre formatam em `America/Sao_Paulo`:

```typescript
const TZ = 'America/Sao_Paulo';

export function formatDateBR(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString('pt-BR', { timeZone: TZ, ...opts });
}

export function formatDateTimeBR(date: string | Date): string {
  return formatDateBR(date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatShortDateTimeBR(date: string | Date): string {
  return formatDateBR(date, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
```

#### 2. Corrigir `ScheduleDialog.tsx` — `calculateNextRun`

Converter a hora selecionada (UTC-3) para UTC antes de calcular: `hourUTC = (hour + 3) % 24`. Exibir a próxima execução usando `formatDateTimeBR`.

#### 3. Corrigir `run-scheduled-analyses` Edge Function

O `hour` salvo no banco é UTC-3. Ajustar `calculateNextRunAt` para converter: `const utcHour = (hour + 3) % 24` antes de usar em `Date.UTC(...)`.

#### 4. Atualizar ~40 arquivos de exibição

Substituir todas as chamadas `toLocaleString('pt-BR')` e `toLocaleString('pt-BR', {...})` por `formatDateBR` / `formatDateTimeBR` / `formatShortDateTimeBR` com `timeZone: 'America/Sao_Paulo'`.

Arquivos principais afetados:
- `src/pages/m365/M365ExecutionsPage.tsx`
- `src/pages/m365/M365PosturePage.tsx`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx`
- `src/pages/admin/SchedulesPage.tsx`
- `src/pages/firewall/AnalyzerDashboardPage.tsx`
- `src/pages/firewall/AnalyzerConfigChangesPage.tsx`
- `src/pages/firewall/FirewallEditPage.tsx`
- `src/pages/ReportsPage.tsx`
- `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`
- `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`
- `src/components/schedule/ScheduleDialog.tsx`
- `src/components/Dashboard.tsx`
- `src/components/pdf/M365PosturePDF.tsx`
- E demais arquivos que usam `toLocaleString('pt-BR')` sem `timeZone`

#### 5. Remover label "(UTC-3)" do ScheduleDialog

Após a correção, o label passa a ser simplesmente "Hora de execução" pois o sistema inteiro já opera em BRT.

### Resumo do impacto

| Componente | Mudança |
|---|---|
| `src/lib/dateUtils.ts` | Novo arquivo com helpers centralizados |
| `ScheduleDialog.tsx` | Converter hora para UTC no cálculo; usar helpers |
| `run-scheduled-analyses` Edge Function | Converter hora UTC-3 → UTC antes de calcular next_run_at |
| ~40 arquivos .tsx | Trocar `toLocaleString('pt-BR')` por helpers com timezone fixo |

