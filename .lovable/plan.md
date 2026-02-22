

# Aumentar Espacamento entre Cards do AssetHealthGrid

## Resumo
Aumentar o gap horizontal (entre colunas) e vertical (entre linhas) no grid de cards.

## Detalhes tecnicos

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

Alterar a classe do grid container de `gap-2` para `gap-x-6 gap-y-4`:
- `gap-x-6` (24px) para o espacamento horizontal entre as duas colunas
- `gap-y-4` (16px) para o espacamento vertical entre as linhas

Linha afetada: a `div` com classe `grid grid-cols-1 sm:grid-cols-2 gap-2`.

