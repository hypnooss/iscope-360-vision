

## Análise de Duplicação nos Analyzers — Resultado

### Fontes de dados por Analyzer

| Analyzer | Fonte de KPIs | Fonte de Insights/Metrics |
|----------|--------------|--------------------------|
| **Exchange** | `useExchangeDashboard` (cache-replace) | `useLatestM365AnalyzerSnapshot` (agrega snapshots) |
| **Entra ID** | `useEntraIdDashboard` (cache-replace) | `useLatestM365AnalyzerSnapshot` (agrega snapshots) |
| **Colaboração** | `useCollaborationDashboard` (cache-replace) | `useLatestM365AnalyzerSnapshot` (agrega snapshots) |

### Onde NÃO há risco de duplicação

1. **Entra ID Dashboard** (edge function): Usa janela contígua (`cached_at` → now). Cache-replace. Sem duplicação.
2. **Collaboration Dashboard** (edge function): Dados de estado (D7). Cache-replace. Sem duplicação.
3. **Exchange Dashboard — mailbox usage**: Dados de estado (D7). Cache-replace. Sem duplicação.

### Onde HÁ risco de duplicação (ou acúmulo infinito)

**1. `exchange-dashboard/index.ts` — Traffic e Security (linhas 276 e 357)**
- Busca TODOS os snapshots completed **sem filtro de tempo**
- Soma `emailTraffic` e `threatProtection` de TODOS
- Se o tenant tem 30 dias de snapshots, o cache mostra 30 dias de tráfego
- Se tem 90 dias, mostra 90 dias — cresce indefinidamente
- **Problema**: O cache salvo no tenant reflete um período arbitrário, não 24h

**2. `useLatestM365AnalyzerSnapshot` (linha 368)**
- Busca até **720 snapshots** com `.limit(720)` e **nenhum filtro temporal**
- Agrega `threatProtection`, `emailTraffic`, `summary` (critical/high/medium/low/info) de TODOS
- Mesma questão: o período agregado cresce indefinidamente

**Não há duplicação no sentido estrito** (cada snapshot cobre uma janela contígua única), mas há **acúmulo sem limite temporal**. O frontend mostra contadores que representam "todo o histórico" e não "últimas 24h".

### Plano de correção — Filtro de 24h

**1. `useLatestM365AnalyzerSnapshot`** em `src/hooks/useM365AnalyzerData.ts` (linha 362-368)
- Adicionar filtro `.gte('created_at', twentyFourHoursAgo.toISOString())` na query
- Remover `.limit(720)` (o filtro temporal já limita)

```ts
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data, error } = await supabase
  .from('m365_analyzer_snapshots')
  .select('...')
  .eq('tenant_record_id', tenantRecordId)
  .eq('status', 'completed')
  .gte('created_at', twentyFourHoursAgo)
  .order('created_at', { ascending: false });
```

**2. `exchange-dashboard/index.ts`** — Traffic (linha 276) e Security (linha 357)
- Adicionar filtro `.gte('created_at', twentyFourHoursAgo)` nas duas queries de snapshots

```ts
const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

// Traffic query
.eq('status', 'completed')
.gte('created_at', twentyFourHoursAgo)

// Security query  
.eq('status', 'completed')
.gte('created_at', twentyFourHoursAgo)
```

### Arquivos modificados
- `src/hooks/useM365AnalyzerData.ts` — filtro 24h na query de snapshots
- `supabase/functions/exchange-dashboard/index.ts` — filtro 24h nas duas queries de snapshots

### Nota
Os dashboards de Entra ID e Colaboração não precisam de alteração — ambos usam cache-replace com dados de execução única (não agregam snapshots).

