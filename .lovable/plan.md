

# Ajustes no Analyzer Dashboard

## 1. Breadcrumb: "Analyzer v2" → "Analyzer"
**Arquivo**: `src/pages/firewall/AnalyzerDashboardV2Page.tsx` (linha 520)
- Alterar `{ label: 'Analyzer v2' }` para `{ label: 'Analyzer' }`.

## 2. Remover badge "v2 Beta"
**Arquivo**: `src/pages/firewall/AnalyzerDashboardV2Page.tsx` (linhas 526-529)
- Remover o bloco `<Badge>` com ícone Sparkles e texto "v2 Beta".

## 3. Insights de Segurança: remover lâmpada + abrir em Sheet lateral

**Arquivo**: `src/components/firewall/SecurityInsightCards.tsx`

- **Linha 39**: Trocar `💡 Insights de Segurança` por `Insights de Segurança` (sem emoji).
- **Substituir Collapsible por Sheet**: Ao clicar no card, em vez de expandir inline com `Collapsible`, abrir um `Sheet` lateral (side="right", ~50vw) com o conteúdo completo do insight (métricas, what/why/bestPractice/businessImpact).
  - Adicionar estado `selectedInsight` para controlar qual insight está aberto no Sheet.
  - O card mantém a exibição das métricas resumidas, mas remove o `CollapsibleTrigger`/`CollapsibleContent` e o chevron.
  - O Sheet segue o padrão do sistema (como `AnalyzerCategorySheet`), com `SheetHeader` contendo título + badge de severidade, e `SheetContent` com as seções de detalhe.

