

# Aproximar Labels do Grafico

## Problema

O `EDGE_MARGIN` de 80px posiciona as bolinhas muito longe do grafico, empurrando os textos para fora da area visivel do card (especialmente "MikroTik bandw..." que fica cortado no lado direito).

## Solucao

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

Reduzir `EDGE_MARGIN` de 80 para 55. Isso aproxima as bolinhas e textos do grafico, mantendo espaco suficiente para os textos sem que fiquem cortados pelas bordas do card.

