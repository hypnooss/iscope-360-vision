

## Unificar Sheets de Insights — Exchange e Entra ID Analyzer

### Problema

Apenas `TeamsSecurityInsightCards` foi atualizado para usar o `IncidentDetailSheet`. Os outros dois módulos ainda têm Sheets inline com layout pobre (emojis, sem abas, sem seções estilizadas):

- `ExchangeSecurityInsightCards.tsx` — Sheet inline (linhas 119-250)
- `EntraIdSecurityInsightCards.tsx` — Sheet inline (linhas 115-239)

### Solução

Mesma refatoração já feita no Teams: substituir a Sheet inline pelo `IncidentDetailSheet`.

### Alterações

**1. `src/components/m365/exchange/ExchangeSecurityInsightCards.tsx`**
- Importar `IncidentDetailSheet` de `@/components/m365/analyzer/IncidentDetailSheet`
- Remover a Sheet inline (linhas 119-250)
- Substituir por `<IncidentDetailSheet insight={selectedInsight} open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)} />`
- Remover imports não usados: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `ScrollArea`, `Mail`, `Lightbulb`, `Users`

**2. `src/components/m365/entra-id/EntraIdSecurityInsightCards.tsx`**
- Importar `IncidentDetailSheet` de `@/components/m365/analyzer/IncidentDetailSheet`
- Remover a Sheet inline (linhas 115-239)
- Substituir por `<IncidentDetailSheet insight={selectedInsight} open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)} />`
- Remover imports não usados: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `ScrollArea`, `Users`

Resultado: os 3 módulos (Exchange, Entra ID, Colaboração) usarão a mesma Sheet rica com abas (Análise/Evidências), seções estilizadas, badges de tendência e detalhamento por usuário.

