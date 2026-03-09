

# Fix: Cards com eventos zerados após otimização de query

## Causa Raiz

A otimização anterior dividiu a query em duas: uma leve (sem `insights`/`metrics`) para 24 snapshots, e uma pesada apenas para o snapshot mais recente. Porém, a função `aggregateSnapshots` soma contadores numéricos (como `vpnFailures`, `inboundBlocked`, `outboundConnections`, etc.) de **todos** os 24 snapshots — e agora 23 deles têm `metrics: {}`, resultando em totais que refletem apenas 1 snapshot em vez de 24.

## Solução

**Arquivo**: `src/hooks/useAnalyzerData.ts` — função `useLatestAnalyzerSnapshot`

Adicionar uma terceira query leve que busca **apenas os contadores numéricos** de todos os 24 snapshots, sem trazer os arrays pesados de rankings/insights. O Supabase/PostgREST não suporta selecionar campos internos de JSONB, então a solução mais prática é:

**Buscar `metrics` para todos os 24 snapshots, mas usando uma coluna calculada ou aceitando o payload.** Como isso causaria o mesmo problema de timeout, a abordagem correta é:

**Alternativa escolhida**: Manter a query leve de 24 snapshots buscando também o campo `score` (já busca), e adicionar uma **query intermediária** que busca apenas `id` e `metrics` dos 24 snapshots, mas com um `select` mais restrito. Como PostgREST não permite selecionar campos internos de JSONB, precisamos de outra abordagem:

**Abordagem final**: Buscar `metrics` de **todos os 24 snapshots**, mas em lotes menores para evitar timeout. Na verdade, o timeout era causado por `select('*')` que também traz `insights` (outro campo JSONB pesado). Buscar apenas `metrics` (sem `insights`) para 24 snapshots deve ser viável.

### Mudança concreta

Na função `useLatestAnalyzerSnapshot`, substituir a query pesada única (que busca `insights, metrics` apenas do latest) por duas queries:

1. **Query de insights**: `select('insights').eq('id', latestId).single()` — apenas para o mais recente (mantém como está)
2. **Query de metrics**: `select('id, metrics')` para **todos** os 24 snapshots — permite a agregação correta dos contadores

Depois, ao construir os snapshots, fazer merge dos metrics de cada row:

```typescript
// Step 2a: Fetch insights only for latest
const { data: insightsData } = await supabase
  .from('analyzer_snapshots')
  .select('insights')
  .eq('id', latestId)
  .single();

// Step 2b: Fetch metrics for all 24 snapshots (no insights = much lighter)
const ids = rows.map(r => r.id);
const { data: metricsRows } = await supabase
  .from('analyzer_snapshots')
  .select('id, metrics')
  .in('id', ids);

// Step 3: Merge
const metricsMap = new Map(metricsRows.map(r => [r.id, r.metrics]));
const snapshots = rows.map((r, idx) => {
  const m = metricsMap.get(r.id) ?? {};
  const ins = idx === 0 ? insightsData?.insights : [];
  return parseSnapshot({ ...r, insights: ins, metrics: m });
});
```

Isso mantém a performance (não busca `insights` para todos) mas restaura os contadores numéricos agregados.

