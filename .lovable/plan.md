
# Adicionar tooltips nos graficos do dashboard

## Mudanca

Envolver o sparkline e a barra de score com o componente `Tooltip` (ja disponivel em `@/components/ui/tooltip`) para exibir texto ao passar o mouse.

### Detalhes

No componente `ModuleHealthCard` dentro de `GeneralDashboardPage.tsx`:

1. Importar `Tooltip, TooltipTrigger, TooltipContent` de `@/components/ui/tooltip`
2. Envolver o `<ScoreSparkline .../>` com Tooltip exibindo "Score nos ultimos 30 dias"
3. Envolver o bloco da barra de progresso (div com `flex items-center gap-2`) com Tooltip exibindo "Score Atual"

Nao e necessario adicionar `TooltipProvider` pois ele ja esta configurado no `App.tsx` ou no layout.

## Arquivo

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Importar Tooltip; envolver sparkline e barra de score com tooltips |
