

# Corrigir Labels Cortados e Aumentar Espacamento Vertical

## Problema

1. As bolinhas estao posicionadas no limite do card (`EDGE_MARGIN = 10`), fazendo com que o texto fique fora da area visivel do card e seja cortado
2. O espacamento vertical entre labels ainda e insuficiente para leitura confortavel

## Solucao

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

1. **Aumentar `EDGE_MARGIN`** de 10 para 80 -- isso move as bolinhas para dentro do card, deixando espaco suficiente para o texto ao lado
2. **Aumentar `MIN_SPACING`** de 38 para 48 -- mais distancia vertical entre cada label para melhor legibilidade

Essas duas alteracoes simples resolvem ambos os problemas sem mudar a logica do algoritmo.

