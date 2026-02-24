

# Plan: Adicionar abas "Entrada Bloqueada" e "Entrada Permitida" nos cards de Trafego

## Contexto

Atualmente, os cards "Top IPs - Trafego" e "Top Paises - Trafego" exibem apenas duas abas: "Saida Bloqueada" e "Saida Permitida". O usuario quer adicionar mais duas abas: "Entrada Bloqueada" e "Entrada Permitida".

## Dados disponiveis

- **Entrada Bloqueada**: Ja existe parcialmente em `topBlockedIPs` / `topCountries` (de `analyzeDeniedTraffic`), porem esses rankings incluem TODOS os IPs negados (tanto externos quanto internos). Precisamos filtrar para incluir apenas trafego de entrada (src = IP publico → dst = IP privado/firewall).
- **Entrada Permitida**: NAO existe. Os logs de `allowed_traffic` sao processados apenas para saida (private src → public dst). Precisamos processar o inverso (public src → private dst) para criar rankings de entrada permitida.

## Alteracoes necessarias

### 1. Edge Function — `supabase/functions/firewall-analyzer/index.ts`

**Separar trafego de entrada no `analyzeDeniedTraffic`:**
- Filtrar logs onde `srcip` nao eh IP privado (entrada externa bloqueada)
- Gerar metricas `topInboundBlockedIPs`, `topInboundBlockedCountries`, `inboundBlocked`

**Processar entrada permitida no `analyzeOutboundTraffic` (ou funcao separada):**
- Dos logs de `allowed_traffic`, filtrar onde src eh IP publico e dst eh IP privado (inbound allowed)
- Gerar metricas `topInboundAllowedIPs`, `topInboundAllowedCountries`, `inboundAllowed`

**Incluir novas metricas no objeto final `metrics` (~linha 1200).**

### 2. Types — `src/types/analyzerInsights.ts`

Adicionar ao `AnalyzerMetrics`:
```text
topInboundBlockedIPs: TopBlockedIP[];
topInboundBlockedCountries: TopCountry[];
inboundBlocked: number;
topInboundAllowedIPs: TopBlockedIP[];
topInboundAllowedCountries: TopCountry[];
inboundAllowed: number;
```

### 3. Aggregacao 24h — `src/hooks/useAnalyzerData.ts`

Na funcao `aggregateSnapshots`, adicionar:
- `sum('inboundBlocked')` e `sum('inboundAllowed')`
- `mergeIPRankings` para `topInboundBlockedIPs` e `topInboundAllowedIPs`
- `mergeCountryRankings` para `topInboundBlockedCountries` e `topInboundAllowedCountries`

### 4. Dashboard — `src/pages/firewall/AnalyzerDashboardPage.tsx`

**Card "Top IPs - Trafego" (~linha 800):**
Adicionar duas abas ao `TabsList`:
```text
Saida Bloqueada | Saida Permitida | Entrada Bloqueada | Entrada Permitida
```
- "Entrada Bloqueada" → `<IPListWidget ips={m?.topInboundBlockedIPs ?? []} />`
- "Entrada Permitida" → `<IPListWidget ips={m?.topInboundAllowedIPs ?? []} />`

**Card "Top Paises - Trafego" (~linha 826):**
Adicionar duas abas:
```text
Saida Bloqueada | Saida Permitida | Entrada Bloqueada | Entrada Permitida
```
- "Entrada Bloqueada" → `<CountryListWidget countries={m?.topInboundBlockedCountries ?? []} />`
- "Entrada Permitida" → `<CountryListWidget countries={m?.topInboundAllowedCountries ?? []} />`

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Separar inbound blocked dos denied logs; processar inbound allowed dos allowed logs; incluir 6 novas metricas |
| `src/types/analyzerInsights.ts` | Adicionar 6 novos campos ao `AnalyzerMetrics` |
| `src/hooks/useAnalyzerData.ts` | Agregar as novas metricas na funcao `aggregateSnapshots` |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Adicionar abas "Entrada Bloqueada" e "Entrada Permitida" nos dois cards de trafego |

## Nota

Apos o deploy da Edge Function, sera necessario re-executar uma coleta para que os novos campos de metricas sejam populados. Snapshots anteriores nao terao esses dados (fallback `?? []` garante que a UI nao quebra).

