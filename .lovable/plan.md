

## Adicionar DataSourceDot e DataSourceLegend no Entra ID Analyzer e Colaboração Analyzer

Ambas as páginas não possuem nenhum `DataSourceDot` nos componentes nem `DataSourceLegend` na linha de coleta. Precisamos replicar o padrão do Exchange Analyzer.

### 1. Páginas (adicionar DataSourceLegend na linha de coleta)

**EntraIdAnalyzerPage.tsx** (linha ~234):
- Importar `DataSourceLegend`
- Adicionar `<DataSourceLegend />` após o badge de "N coletas", dentro do `div` de última coleta

**TeamsAnalyzerPage.tsx** (linha ~219):
- Mesmo padrão: importar e adicionar `<DataSourceLegend />` na linha de última coleta

### 2. Stats Cards (DataSourceDot snapshot)

**EntraIdAnalyzerStatsCards.tsx** — Cada card recebe `relative` e `<DataSourceDot source="snapshot" />` com `absolute top-3 right-3` (dados vêm do dashboard cache = última coleta)

**TeamsAnalyzerStatsCards.tsx** — Mesmo padrão nos 5 cards (Total Teams, Públicas, Convidados, Compartilhamento Externo, Storage)

### 3. Category Grids (DataSourceDot snapshot)

**EntraIdAnalyzerCategoryGrid.tsx** — Adicionar `<DataSourceDot source="snapshot" />` com `absolute top-3 right-3` em cada card da grid (dados vêm do dashboard cache = última coleta)

**TeamsAnalyzerCategoryGrid.tsx** — Mesmo padrão nos cards da grid

### 4. Security Insight Cards (DataSourceDot analyzed)

**EntraIdSecurityInsightCards.tsx** — Adicionar `<DataSourceDot source="analyzed" />` ao lado do badge de severidade no header de cada card insight

**TeamsSecurityInsightCards.tsx** — Mesmo padrão

### 5. Login Map (Entra ID only - DataSourceDot aggregated)

**EntraIdLoginMap.tsx** — Adicionar `<DataSourceDot source="aggregated" />` ao lado do título do mapa (dados de login são agregados do período)

### Resumo de arquivos alterados
- `src/pages/m365/EntraIdAnalyzerPage.tsx` — import + legend
- `src/pages/m365/TeamsAnalyzerPage.tsx` — import + legend
- `src/components/m365/entra-id/EntraIdAnalyzerStatsCards.tsx` — dots snapshot
- `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx` — dots snapshot
- `src/components/m365/entra-id/EntraIdSecurityInsightCards.tsx` — dots analyzed
- `src/components/m365/entra-id/EntraIdLoginMap.tsx` — dot aggregated
- `src/components/m365/teams/TeamsAnalyzerStatsCards.tsx` — dots snapshot
- `src/components/m365/teams/TeamsAnalyzerCategoryGrid.tsx` — dots snapshot
- `src/components/m365/teams/TeamsSecurityInsightCards.tsx` — dots analyzed

