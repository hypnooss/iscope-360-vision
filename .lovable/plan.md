# Status: ✅ Implementado

## Alteração: Contagem real de config changes (30 dias) no card do Analyzer

### O que foi feito

1. **Query de contagem** (`src/pages/firewall/AnalyzerDashboardV2Page.tsx`):
   - Nova query `configChangesCount30d` usando `select('id', { count: 'exact', head: true })` na tabela `analyzer_config_changes` com filtro de 30 dias
   - Passada como prop `configChangesTotal30d` ao `AnalyzerCategoryGrid`

2. **Grid de categorias** (`src/components/firewall/AnalyzerCategoryGrid.tsx`):
   - Nova prop opcional `configChangesTotal30d`
   - No `case 'config_changes'`, prioriza o valor de 30 dias (prop) sobre o `metrics.configChanges` (snapshot)
   - Fallback para o valor do snapshot se a prop não estiver disponível
