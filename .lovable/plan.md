

# Adicionar Visibilidade de Anomalias ao Firewall Analyzer

## O que sao Anomalias no FortiOS

O FortiOS registra eventos de anomalia quando o motor de deteccao identifica comportamentos anormais de rede, incluindo:

- **DoS/DDoS**: Floods (SYN, UDP, ICMP), sessoes excessivas por IP
- **Anomalias de Protocolo**: Pacotes malformados, fragmentacao suspeita
- **Rate-based**: Limites de sessao excedidos por politica
- **Scan Detection**: Varreduras de rede detectadas pelo sensor de anomalia

Os logs de anomalia contem campos como `attack`, `srcip`, `dstip`, `count`, `severity`, `action` (pass/drop), `policyid` e `service`.

## Alteracoes Necessarias

### 1. Blueprint - Novo Step de Coleta

Adicionar um novo step `anomaly_events` ao blueprint "FortiGate - Analyzer":

| Campo | Valor |
|---|---|
| id | `anomaly_events` |
| path | `/api/v2/log/memory/anomaly?rows=500&extra=country_id` |
| optional | `true` (nem todo FortiGate tem anomaly habilitado) |

### 2. Edge Function - Novo Modulo `analyzeAnomalies`

Novo modulo de analise em `supabase/functions/firewall-analyzer/index.ts`:

- Agrupa anomalias por tipo de ataque (`attack` field)
- Gera ranking de **Top IPs de Origem** de anomalias
- Gera ranking de **Top Tipos de Anomalia** por contagem
- Detecta padroes criticos:
  - Floods (SYN/UDP/ICMP flood) -> severity critical
  - Scan detection -> severity high
  - Sessoes excessivas por IP -> severity medium
- Calcula metricas: `anomalyEvents`, `anomalyDropped`, `topAnomalySources`, `topAnomalyTypes`

### 3. Tipos TypeScript - Novas Metricas

Atualizar `src/types/analyzerInsights.ts`:

- Novo valor em `AnalyzerCategory`: `'anomaly'`
- Novas propriedades em `AnalyzerMetrics`:
  - `anomalyEvents: number` - total de eventos de anomalia
  - `anomalyDropped: number` - total de anomalias com action=drop
  - `topAnomalySources: TopBlockedIP[]` - top IPs geradores de anomalias
  - `topAnomalyTypes: TopCategory[]` - top tipos de anomalia

### 4. Hook de Dados

Atualizar `src/hooks/useAnalyzerData.ts` para parsear as novas metricas com defaults seguros.

### 5. Dashboard - Novo Widget

Adicionar um card "Anomalias" no `AnalyzerDashboardPage.tsx`:

- Contador principal: total de anomalias detectadas vs bloqueadas
- Lista de **Top Tipos de Anomalia** com barras de progresso
- Lista de **Top IPs Origem** de anomalias com bandeiras
- Insights de anomalia aparecem automaticamente na pagina de Insights (ja existente)

### 6. Insights Page

O `AnalyzerInsightsPage.tsx` ja suporta qualquer categoria dinamicamente - basta adicionar o label `'anomaly'` no mapa `categoryLabels`.

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| Migration SQL (blueprint) | Adicionar step `anomaly_events` |
| `supabase/functions/firewall-analyzer/index.ts` | Novo modulo `analyzeAnomalies`, integracao no fluxo principal |
| `src/types/analyzerInsights.ts` | Nova categoria + novas metricas |
| `src/hooks/useAnalyzerData.ts` | Parse das novas metricas |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Novo widget de anomalias |
| `src/pages/firewall/AnalyzerInsightsPage.tsx` | Novo label de categoria |

## Resultado Esperado

- Novo card "Anomalias" no dashboard do Analyzer com contadores e rankings
- Insights de anomalia (floods, scans, sessoes excessivas) na pagina de drill-down
- Dados coletados automaticamente na proxima execucao do Analyzer
- Sem impacto em firewalls que nao tenham anomaly habilitado (step marcado como `optional`)

