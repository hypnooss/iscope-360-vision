

## Legenda de Origem dos Dados — Exchange Analyzer

### Classificação dos Cards por Fonte de Dados

| Seção | Fonte | Ponto |
|-------|-------|-------|
| **ExchangeAnalyzerStatsCards** (Total Mailboxes, Phishing, Malware, Forwarding) | `useExchangeDashboard` — último snapshot do dashboard | 🟢 Verde (última snapshot) para Mailboxes/Forwarding; 🔵 Azul (agregado 24h) para Phishing/Malware |
| **ExchangeAnalyzerCategoryGrid** — Tráfego, Anti-Spam, Phishing, Malware | `useExchangeDashboard` — dados de evento agregados pela Edge Function | 🔵 Azul (agregado) |
| **ExchangeAnalyzerCategoryGrid** — Forwarding, Auto-Reply, Inativas, Over Quota | `useExchangeDashboard` — dados de estado point-in-time | 🟢 Verde (última snapshot) |
| **ExchangeThreatProtectionSection** | `useLatestM365AnalyzerSnapshot` — métricas do analyzer | 🟣 Roxo (analisado) |
| **ExchangeSecurityInsightCards** | `useLatestM365AnalyzerSnapshot` — insights filtrados | 🟣 Roxo (analisado) |

### Implementação

**1. Componente `DataSourceDot`** (`src/components/m365/shared/DataSourceDot.tsx`)

Um pequeno círculo colorido (8px) com tooltip explicativo:
- `source="snapshot"` → verde (`#22c55e`) — "Dados da última coleta"
- `source="aggregated"` → azul (`#3b82f6`) — "Dados agregados do período"
- `source="analyzed"` → roxo (`#a855f7`) — "Dados analisados pelo agente"

**2. Componente `DataSourceLegend`** (`src/components/m365/shared/DataSourceLegend.tsx`)

Barra horizontal compacta com os 3 pontos + rótulos, exibida ao lado do badge "X coletas" na área de metadados (linha ~258 do `ExchangeAnalyzerPage.tsx`), no estilo da referência visual enviada.

**3. Inserir dots nos cards**

- **`ExchangeAnalyzerStatsCards`**: Adicionar `DataSourceDot` no canto superior direito de cada card. Mailboxes e Forwarding recebem `source="snapshot"`, Phishing e Malware recebem `source="aggregated"`.
- **`ExchangeAnalyzerCategoryGrid`**: Adicionar `DataSourceDot` no canto superior direito de cada card da grid. Categorias de evento (`email_traffic`, `anti_spam`, `phishing`, `malware`) recebem `source="aggregated"`, categorias de estado (`forwarding`, `auto_reply`, `inactive_mailboxes`, `over_quota`) recebem `source="snapshot"`.
- **`ExchangeThreatProtectionSection`**: Dot roxo no header da seção.
- **`ExchangeSecurityInsightCards`**: Dot roxo no header da seção.

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/m365/shared/DataSourceDot.tsx` | **Novo** — componente dot + tooltip |
| `src/components/m365/shared/DataSourceLegend.tsx` | **Novo** — barra de legenda horizontal |
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | Inserir `DataSourceLegend` na área de metadados |
| `src/components/m365/exchange/ExchangeAnalyzerStatsCards.tsx` | Adicionar dots por card |
| `src/components/m365/exchange/ExchangeAnalyzerCategoryGrid.tsx` | Adicionar dots por card |
| `src/components/m365/exchange/ExchangeThreatProtectionSection.tsx` | Adicionar dot no header |
| `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx` | Adicionar dot no header |

