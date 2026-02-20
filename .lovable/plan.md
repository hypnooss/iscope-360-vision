

# Ajustar Posicao de Bolinha e Texto por Lado

## Problema

Atualmente, os labels dos dois lados posicionam o texto sempre do mesmo lado da bolinha, fazendo com que no lado direito o texto sobreponha a linha conectora, e no lado esquerdo fique desalinhado.

## Solucao

No `OuterLabelsLayer.tsx`, inverter a logica de posicionamento:

- **Lado esquerdo**: bolinha na posicao `EDGE_MARGIN`, texto a direita da bolinha (`textX = EDGE_MARGIN + 6`), `textAnchor = "start"`
- **Lado direito**: bolinha na posicao `width - EDGE_MARGIN`, texto a esquerda da bolinha (`textX = width - EDGE_MARGIN - 6`), `textAnchor = "end"`

## Detalhe Tecnico

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

Na funcao `renderGroup`, a bolinha (`<circle>`) fica no ponto final da polyline (`ex3`). O texto precisa ser posicionado ao lado correto:

- Para `isRight = true`: `textAnchor = "end"` e `textX = ex3 - 6` (texto cresce para a esquerda, afastando-se da borda)
- Para `isRight = false`: `textAnchor = "start"` e `textX = ex3 + 6` (texto cresce para a direita, afastando-se da borda)

Isso garante que o texto nunca sobreponha a bolinha nem a linha conectora, pois fica sempre no lado oposto ao grafico.

