

## Diagnóstico: Drill-down de Tráfego de Email sem dados

### Causa raiz

O Edge Function `m365-analyzer` salva corretamente `emailTrafficRankings` e `mailboxRankings` no campo `metrics` (JSONB) do snapshot. Porém, no frontend:

1. O tipo `M365AnalyzerMetrics` (`src/types/m365AnalyzerInsights.ts`) **não declara** `emailTrafficRankings` nem `mailboxRankings`
2. A função `parseMetrics` (`src/hooks/useM365AnalyzerData.ts`) reconstrói o objeto campo a campo e **descarta** tudo que não está mapeado -- incluindo esses dois campos
3. O `ExchangeCategorySheet` tenta acessar `analyzerMetrics?.emailTrafficRankings` que é sempre `undefined`

### Correção

**1. `src/types/m365AnalyzerInsights.ts`** -- Adicionar os tipos ao interface `M365AnalyzerMetrics`:

```typescript
emailTrafficRankings?: {
  topSenders: { name: string; count: number }[];
  topRecipients: { name: string; count: number }[];
  topDestinationDomains: { name: string; count: number }[];
  topSourceDomains: { name: string; count: number }[];
};
mailboxRankings?: {
  topForwarding: { name: string; forwardTo: string }[];
  topInactive: { name: string; lastLogin: string }[];
  topOverQuota: { name: string; usagePct: number }[];
};
```

**2. `src/hooks/useM365AnalyzerData.ts`** -- Na função `parseMetrics`, adicionar parsing desses dois campos antes do `return`:

```typescript
const etr = m.emailTrafficRankings ?? m.email_traffic_rankings ?? {};
const mbr = m.mailboxRankings ?? m.mailbox_rankings ?? {};

return {
  ...existingFields,
  emailTrafficRankings: {
    topSenders: safeArray(etr.topSenders),
    topRecipients: safeArray(etr.topRecipients),
    topDestinationDomains: safeArray(etr.topDestinationDomains),
    topSourceDomains: safeArray(etr.topSourceDomains),
  },
  mailboxRankings: {
    topForwarding: safeArray(mbr.topForwarding),
    topInactive: safeArray(mbr.topInactive),
    topOverQuota: safeArray(mbr.topOverQuota),
  },
};
```

Nenhuma alteração no backend ou no componente `ExchangeCategorySheet` é necessária -- ele já lê `traffic?.topSenders` etc. corretamente. O problema é exclusivamente que `parseMetrics` filtra os campos.

