
# Labels por Quadrante no Donut

## Problema
O algoritmo atual divide labels apenas em esquerda/direita. Isso causa problemas quando uma fatia esta no topo-direito mas o label e empurrado para baixo pela anti-colisao, ou quando uma fatia esta embaixo mas o label sobe. As setas vermelhas na imagem mostram exatamente esses casos.

## Solucao
Dividir o grafico em 4 quadrantes e posicionar cada label de acordo com o quadrante da sua fatia:

- **Topo-Direito (0-90 graus)**: label vai para cima e para a direita
- **Topo-Esquerdo (90-180 graus)**: label vai para cima e para a esquerda
- **Baixo-Esquerdo (180-270 graus)**: label vai para baixo e para a esquerda
- **Baixo-Direito (270-360 graus)**: label vai para baixo e para a direita

Cada quadrante resolve colisoes apenas dentro do seu proprio grupo, respeitando a direcao natural.

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

**1. Substituir a divisao esquerda/direita por 4 quadrantes**

Ao inves de dividir por `cos >= 0`, classificar cada label em um dos 4 quadrantes com base no `midAngle`:
```text
quadrante = angulo 0-90    -> 'top-right'
quadrante = angulo 90-180  -> 'top-left'
quadrante = angulo 180-270 -> 'bottom-left'
quadrante = angulo 270-360 -> 'bottom-right'
```

**2. Ordenar cada quadrante de forma coerente**

- Top-right: ordenar por naturalY decrescente (de baixo para cima, os mais proximos do centro primeiro)
- Top-left: ordenar por naturalY decrescente (idem)
- Bottom-left: ordenar por naturalY crescente (de cima para baixo)
- Bottom-right: ordenar por naturalY crescente (idem)

**3. Anti-colisao por quadrante**

Cada quadrante resolve colisoes na sua direcao:
- Quadrantes de topo: labels sao empurrados para cima quando colidem (respeitando minY)
- Quadrantes de baixo: labels sao empurrados para baixo quando colidem (respeitando maxY)

**4. Manter o X dinamico**

A logica de posicao X continua sendo calculada radialmente (ex2 + HORIZONTAL_LEN), sem alinhamento em coluna. Cada label fica no X natural da sua extensao radial.

**5. Renderizacao**

- Quadrantes direitos: textAnchor = 'start', ex3 = ex2 + HORIZONTAL_LEN
- Quadrantes esquerdos: textAnchor = 'end', ex3 = ex2 - HORIZONTAL_LEN
- Clamping de seguranca nos limites do card (MARGIN = 10)
