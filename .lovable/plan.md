

# Ocultar "Ativos Afetados" no painel de detalhe do ativo

## Problema
Quando abrimos o painel lateral de um ativo especifico e expandimos um achado na aba "Analise", a secao "ATIVOS AFETADOS" lista todos os hosts afetados por aquele achado -- incluindo outros hosts. Isso e redundante e confuso, pois ja estamos no contexto de um unico ativo.

## Solucao

**Arquivo**: `src/components/surface/SurfaceFindingCard.tsx`

Adicionar uma prop opcional `hideAffectedAssets?: boolean` ao componente. Quando `true`, oculta tanto o contador de ativos afetados (nivel 2) quanto a secao expandida "ATIVOS AFETADOS" (nivel 3).

**Arquivo**: `src/components/surface/AssetDetailSheet.tsx`

Passar `hideAffectedAssets={true}` ao renderizar os `SurfaceFindingCard` dentro da aba "Analise".

Isso mantem o comportamento original em todas as outras paginas (AllFindingsPage, CategoryDetailSheet, etc.) e remove a informacao redundante apenas no contexto do detalhe de um ativo individual.

