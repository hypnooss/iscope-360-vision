

# Fallback para cache vazio do Exchange Dashboard

## Problema
Quando `exchange_dashboard_cache` é `null` (tenant nunca teve o dashboard Exchange coletado), os KPI cards mostram zeros enganosos.

## Solução
No `ExchangeAnalyzerPage.tsx`, quando `dashboardData === null` e `selectedTenantId` existe e não está loading:

1. **Esconder** os componentes `ExchangeAnalyzerStatsCards` e `ExchangeAnalyzerCategoryGrid` (que dependem do cache)
2. **Exibir** um Alert informativo no lugar, com botão "Atualizar Dashboard" que chama `refresh()` do hook `useExchangeDashboard`
3. Expor `refresh` e `refreshing` do hook na page (já retornados pelo hook, só não estão sendo usados)

### Alteração em `ExchangeAnalyzerPage.tsx`

- Desestruturar `refresh` e `refreshing` do `useExchangeDashboard`
- Condicionar a renderização dos stats cards: só exibir se `dashboardData !== null`
- Adicionar bloco de empty state (Alert + botão) quando `dashboardData === null && selectedTenantId && !dashboardLoading`
- Seguir o padrão de empty state já usado no projeto (ícone + texto + CTA)

### Arquivo alterado
- `src/pages/m365/ExchangeAnalyzerPage.tsx`

