
# Adicionar botao "Disparar Scan" no Attack Surface Analyzer (apenas Super Roles)

## Resumo
Adicionar um botao para disparar manualmente o scan do Attack Surface Analyzer, visivel apenas para usuarios com role `super_admin` ou `super_suporte`.

## Alteracoes

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

1. Importar o hook `useAttackSurfaceScan` de `@/hooks/useAttackSurfaceData`
2. Importar o icone `Play` do lucide-react
3. Importar o componente `Button` de `@/components/ui/button`
4. Instanciar o hook: `const scanMutation = useAttackSurfaceScan(selectedClientId)`
5. Dentro do bloco do header (ao lado do seletor de workspace, linha ~450-464), adicionar um botao condicional:
   - Visivel apenas quando `isSuperRole` for `true`
   - Desabilitado quando `isRunning` ou `scanMutation.isPending`
   - Ao clicar, chama `scanMutation.mutate()`
   - Texto: "Disparar Scan" com icone Play (ou Loader2 girando quando em execucao)

### Secao tecnica

O hook `useAttackSurfaceScan` ja existe e invoca a edge function `attack-surface-scan`. Ele tambem invalida os caches relevantes e exibe toast de sucesso/erro. Nenhuma alteracao no backend e necessaria.

O botao ficara posicionado a direita do seletor de workspace, no mesmo flex container, seguindo o padrao visual existente.
