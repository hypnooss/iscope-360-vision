

# Adicionar tooltip no badge "+N" de servicos/tecnologias

## Problema
O badge "+7" (overflow de tecnologias) no card do Asset nao exibe tooltip ao passar o mouse. O usuario espera ver a lista completa dos servicos ocultos.

## Mudanca

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Envolver o badge `+{overflowTechs}` (linha ~1060) com um `Tooltip` que exibe a lista dos servicos ocultos (`asset.allTechs.slice(MAX_TECHS)`), separados por virgula ou em lista vertical.

### Detalhes tecnicos

- O componente `AssetCard` ja importa `Tooltip`, `TooltipTrigger`, `TooltipContent` e `TooltipProvider` (usado no IP badge acima)
- A lista oculta sera: `asset.allTechs.slice(MAX_TECHS)`
- O tooltip exibira os nomes em lista vertical para melhor legibilidade
- O badge recebera `cursor-help` para indicar interatividade

