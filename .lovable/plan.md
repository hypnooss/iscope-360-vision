

## Refatorar M365 Compliance: Layout identico ao Firewall/Domain Compliance

### Situacao atual
A tela M365 Compliance abaixo do Command Central tem:
1. Grid de **M365CategoryCard** (cards resumo por categoria com score) -- secao "Categorias de Risco"
2. Secao separada **"Coleta via Agent (PowerShell)"** com cards basicos
3. Secao **"Insights Detalhados (Graph API)"** com `M365InsightCard` em grid 2 colunas, agrupados por categoria com titulo simples

O Firewall Compliance usa:
- `CategorySection` com header colapsivel (icone + nome + badges de severidade + pass rate %)
- Cards em grid 2 colunas com `ComplianceCard`
- Clique no card abre `ComplianceDetailSheet` (sheet lateral com abas)

### Plano

**1. Refatorar `M365CategorySection.tsx`** -- adicionar `ComplianceDetailSheet`
- Ja existe e tem layout muito proximo do Firewall `CategorySection` (header colapsivel, badges, grid)
- Adicionar estado `selectedInsight` + `sheetOpen`
- Passar `onClick` ao `M365InsightCard` para abrir a sheet lateral em vez do collapsible inline
- Renderizar `ComplianceDetailSheet` no final do componente

**2. Refatorar `M365InsightCard.tsx`** -- aceitar `onClick`
- Receber prop opcional `onClick` e repassa-la ao `UnifiedComplianceCard`
- Quando `onClick` presente, o card mostra "Detalhes >" em vez do collapsible

**3. Refatorar `M365PosturePage.tsx`** -- unificar layout
- **Remover** a secao "Categorias de Risco" (grid de `M365CategoryCard`) -- linhas 227-249
- **Remover** a secao separada "Coleta via Agent (PowerShell)" -- linhas 251-340
- **Remover** o separador e titulo "Insights Detalhados (Graph API)" -- linhas 342-347
- **Merge** agent insights com Graph insights antes do agrupamento por categoria: converter `agentInsights` (M365AgentInsight[]) para `M365Insight[]` e concatenar com `data.insights`
- **Substituir** o bloco de categorias por `M365CategorySection` (o componente que ja existe com header colapsivel, badges, pass rate)
- Titulo da secao: "Verificacoes por Categoria" (igual Firewall)

### Arquivos a editar
1. `src/components/m365/posture/M365InsightCard.tsx` -- aceitar e passar `onClick`
2. `src/components/m365/posture/M365CategorySection.tsx` -- adicionar ComplianceDetailSheet + estado
3. `src/pages/m365/M365PosturePage.tsx` -- merge agent insights, remover secoes separadas, usar M365CategorySection

### Resultado
- Layout identico ao Firewall: headers collapsiveis por categoria com badges + pass rate, cards em grid 2 colunas, sheet lateral com abas ao clicar
- Agent insights integrados nas categorias em vez de secao separada
- Dialogs de Remediacao e Entidades Afetadas continuam funcionando via M365InsightCard

