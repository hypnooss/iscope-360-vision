

## Plano: Alinhar scheduled_hour com a correção de timezone

### Problema

Os valores `scheduled_hour` nas tabelas `m365_compliance_schedules` e `m365_analyzer_schedules` foram salvos como horas UTC pelo código antigo (ex: `scheduled_hour = 11` → 11:00 UTC = 08:00 BRT).

Com o fix que acabamos de aplicar ao `run-scheduled-analyses`, esses mesmos valores agora serão interpretados como BRT e convertidos para UTC (+3h). Resultado: uma execução que rodava às 11:00 UTC (08:00 BRT) passará a rodar às 14:00 UTC (11:00 BRT) — um deslocamento de 3 horas.

### Há duas opções

**Opção A — Corrigir os dados no banco** (recomendada): Subtrair 3 horas de todos os `scheduled_hour` existentes para que, com a nova conversão BRT→UTC, os horários reais de execução permaneçam os mesmos. Ex: `11` → `8` (8:00 BRT → 11:00 UTC).

**Opção B — Não converter na edge function**: Reverter o `(hour + 3) % 24` no `run-scheduled-analyses` e manter `scheduled_hour` como UTC. A UI já mostra o valor direto, então basta adicionar o label "(UTC)" ou converter na exibição.

### Recomendação: Opção A

Manter a conversão na edge function (BRT→UTC) é o comportamento correto a longo prazo. O que precisamos é ajustar os dados existentes:

1. **Migration SQL**: `UPDATE m365_compliance_schedules SET scheduled_hour = (scheduled_hour - 3 + 24) % 24` (e idem para `m365_analyzer_schedules`, `analysis_schedules`, `analyzer_schedules`, `attack_surface_schedules`)
2. **Recalcular `next_run_at`**: Após ajustar os hours, recalcular todos os `next_run_at` com a fórmula correta
3. **Verificar o ScheduleDialog**: Confirmar que ao criar novos agendamentos, o `scheduled_hour` é salvo como BRT (que é o que o usuário seleciona)

### Arquivos afetados

| Componente | Ação |
|---|---|
| Migration SQL | Ajustar `scheduled_hour` em 5 tabelas de agendamento |
| `supabase/functions/run-scheduled-analyses/index.ts` | Já corrigido (manter) |
| `src/components/schedule/ScheduleDialog.tsx` | Verificar que salva hora como BRT |

