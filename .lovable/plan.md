
# Fix: Recalcular summary com todos os insights

## Problema

O summary na tabela `m365_posture_history` esta zerado porque:

1. O `result.summary` vem da Edge Function `m365-security-posture`, que calcula o summary apenas com os insights da **Graph API** (4 insights, todos `pass`)
2. Os insights do Exchange Online (mergeados na linha 225) nao sao contabilizados no summary
3. Os `agent_insights` (que chegam depois via `agent-task-result`) tambem nao atualizam o summary

## Solucao

### 1. `supabase/functions/trigger-m365-posture-analysis/index.ts`

Apos mergear os `exoInsights` em `allInsights` (linha 225), **recalcular o summary** antes de persistir:

```typescript
// Recalculate summary with ALL insights (API + Exchange)
const recalculatedSummary = {
  critical: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'critical').length,
  high: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'high').length,
  medium: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'medium').length,
  low: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'low').length,
  info: allInsights.filter((i: any) => i.severity === 'info').length,
  total: allInsights.length,
};
```

E na linha 243, trocar `summary: result.summary` por `summary: recalculatedSummary`.

### 2. `supabase/functions/agent-task-result/index.ts`

Quando o Agent finaliza uma task M365 e salva `agent_insights`, tambem recalcular o summary combinando `insights` + `agent_insights` e atualizar o registro no `m365_posture_history`.

Isso requer:
- Buscar o registro atual do `m365_posture_history` pelo `analysis_id`
- Combinar `insights` (ja salvos) + novos `agent_insights`
- Recalcular summary e score
- Atualizar o registro com o novo summary

### Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `trigger-m365-posture-analysis/index.ts` | Recalcular summary apos merge de exoInsights |
| `agent-task-result/index.ts` | Recalcular summary quando agent_insights sao salvos |

Nenhuma alteracao de frontend necessaria -- o dialog de detalhes ja exibe `selectedExecution.summary` corretamente, so faltam os dados no banco.
