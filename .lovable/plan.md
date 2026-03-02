

## Correção: Insights do M365 Analyzer não carregando (0 incidentes)

### Problema

A query em `useLatestM365AnalyzerSnapshot` omite a coluna `insights` do `.select()`:

```
.select('id, tenant_record_id, client_id, agent_task_id, status, period_start, period_end, score, summary, metrics, created_at')
```

Resultado: `insights` chega como `undefined`, parseado como `[]`, e o dashboard mostra 0 incidentes apesar de existirem 233 reais no banco.

### Solução

Estratégia em duas partes para manter a performance:

**1. Carregar insights apenas do snapshot mais recente**

A query atual busca 24 snapshots para agregar summaries/metrics. Carregar `insights` de todos os 24 seria pesado e redundante. A solução:
- Manter a query principal (24 snapshots) SEM `insights` para agregar summaries
- Fazer uma segunda query apenas para o snapshot mais recente, buscando apenas `id, insights`
- Usar os insights dessa segunda query no resultado final

**2. Melhorar a deduplicação de insights**

O `deduplicateInsights` atual usa `category::name` como chave. Regras como "Regra de Inbox Suspeita" para cada usuário individual teriam o mesmo `name` mas `description` diferente, sendo colapsadas incorretamente. A correção:
- Incluir também o `id` ou `description` na chave de deduplicação quando existirem múltiplas entidades afetadas

### Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useM365AnalyzerData.ts` | Adicionar segunda query para insights do snapshot mais recente; ajustar deduplicacao |

### Detalhes Tecnicos

Na funcao `useLatestM365AnalyzerSnapshot`:

```typescript
// Query 1: summaries + metrics de 24 snapshots (sem insights)
const { data: rows } = await supabase
  .from('m365_analyzer_snapshots')
  .select('id, tenant_record_id, ..., summary, metrics, created_at')
  .eq('tenant_record_id', tenantRecordId)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(24);

// Query 2: insights apenas do mais recente
const { data: latestWithInsights } = await supabase
  .from('m365_analyzer_snapshots')
  .select('id, insights')
  .eq('id', rows[0].id)
  .single();

// Merge no resultado final
aggregated.insights = latestWithInsights?.insights ?? [];
```

Para a deduplicacao, mudar a chave para `category::name::id` (onde `id` e o ID unico do insight gerado pelo backend).
