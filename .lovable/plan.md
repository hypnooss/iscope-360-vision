

# Fix: Stats Cards e Category Grid não renderizam

## Causa raiz

Na `ExchangeAnalyzerPage.tsx`, linhas 193-202, os Stats Cards e Category Grid estão condicionados a `dashboardData` ser non-null. O hook `useExchangeDashboard` retorna `null` quando não há `exchange_dashboard_cache` no tenant — o que é o caso para tenants que só têm dados de insights (compliance) mas nunca executaram a coleta operacional do dashboard.

## Solução

Fornecer um **fallback com valores zerados** quando `dashboardData` é null, para que os cards e grid sempre renderizem (com zeros quando não há dados operacionais). Isso mantém a estrutura visual da página consistente.

### Arquivo: `src/pages/m365/ExchangeAnalyzerPage.tsx`

1. Criar um objeto `DEFAULT_DASHBOARD_DATA` com todos os valores zerados
2. Usar `const effectiveDashboard = dashboardData ?? DEFAULT_DASHBOARD_DATA` 
3. Remover os guards `dashboardData &&` das seções de Stats Cards e Category Grid — renderizar sempre que `selectedTenantId` existir e não estiver carregando

Isso é uma mudança de ~10 linhas no arquivo da página, sem alterar os componentes.

