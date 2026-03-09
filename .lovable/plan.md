

# Análise de Performance: `/scope-firewall/analyzer`

## Causa Raiz Identificada

A query principal está causando **timeout no banco de dados**. Nos network requests, há um erro 500 claro:

```
GET /analyzer_snapshots?select=*&firewall_id=eq.98640ddd-...&status=eq.completed&order=created_at.desc&limit=24
Status: 500
Response: {"code":"57014","message":"canceling statement due to statement timeout"}
```

O problema principal é a query em `useLatestAnalyzerSnapshot` (linha 323 de `useAnalyzerData.ts`):

```typescript
.select('*')  // <-- busca TODAS as colunas, incluindo insights e metrics (JSONs enormes)
```

Cada snapshot contém `insights` (array de objetos) e `metrics` (objeto grande com dezenas de campos). Buscar 24 snapshots com `select('*')` força o Postgres a serializar uma quantidade massiva de JSON, causando timeout.

## Evidência

- O firewall `4c942d5c` (USINA-FW) retorna com sucesso mas leva tempo -- os JSONs de metrics/insights são enormes (veja o response body nos logs).
- O firewall `98640ddd` dá timeout direto (500).
- A página também dispara **múltiplas queries paralelas** ao carregar (firewalls, snapshot, progress, config changes, firewall URL, WAN IP, schedules, compliance task).

## Plano de Correção

### 1. Otimizar a query principal (`useAnalyzerData.ts`)

Atualmente faz `select('*')` que traz `insights` e `metrics` (campos JSONB pesados) para 24 rows.

**Correção**: Buscar apenas colunas leves na query inicial, e carregar `insights` e `metrics` somente do snapshot mais recente (como já faz parcialmente para o M365 analyzer):

```typescript
// Query leve: sem insights nem metrics
.select('id, firewall_id, client_id, agent_task_id, status, period_start, period_end, score, summary, created_at')
.limit(24)

// Depois, buscar insights + metrics apenas do snapshot[0]
.select('insights, metrics')
.eq('id', rows[0].id)
.single()
```

Isso reduz drasticamente o volume de dados transferido e o tempo de serialização no Postgres.

### 2. Ajustar `aggregateSnapshots`

A função `aggregateSnapshots` hoje acumula insights de todos os 24 snapshots, mas na prática o código já recarrega insights apenas do mais recente. Podemos simplificar para usar `summary` (campo leve) para agregação de severidades, e `metrics` apenas do latest.

### Arquivo alterado

- `src/hooks/useAnalyzerData.ts` — função `useLatestAnalyzerSnapshot`: substituir `select('*')` por select com colunas explícitas, e carregar insights/metrics separadamente apenas para o snapshot mais recente.

