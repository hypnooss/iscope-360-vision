
# Corrigir Direcao do Texto com Base na Posicao Real na Tela

## Problema
O texto das labels (ex: "Outros") vai na direcao errada porque a classificacao por quadrante depende de calculos de angulo que podem nao corresponder exatamente ao posicionamento visual real do Recharts. Mesmo com a logica matematicamente correta, diferencas sutis na convencao de angulos fazem com que um item como "Outros" (visualmente embaixo) seja classificado no quadrante errado.

## Solucao
Abandonar a classificacao por angulo para determinar a direcao do texto. Em vez disso, usar a **posicao real na tela** do ponto final da label:
- Se o ponto (dot) esta ABAIXO do centro do grafico: texto desce
- Se o ponto esta ACIMA do centro: texto sobe
- Se o ponto esta a DIREITA do centro: texto alinha a direita
- Se esta a ESQUERDA: texto alinha a esquerda

Isso elimina qualquer dependencia de convencao de angulos.

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

Na funcao `renderGroup`, substituir as determinacoes de `isRight` e `isTop` baseadas no quadrante por comparacoes de posicao na tela:

Trocar:
```text
const isRight = item.quadrant === 'top-right' || item.quadrant === 'bottom-right';
const isTop = item.quadrant === 'top-right' || item.quadrant === 'top-left';
```

Por:
```text
const isRight = item.ex2 >= cx;
const textGoesDown = ey3 >= cy;
```

E ajustar os offsets de Y do texto:
```text
const nameY = textGoesDown ? ey3 + 5 : ey3 - 16;
const valueY = textGoesDown ? ey3 + 18 : ey3 - 3;
```

Isso garante que, independente de qualquer convencao de angulo, a direcao visual do texto segue a posicao real do ponto na tela. "Outros" embaixo do centro tera o texto descendo. "Bootstrap" acima do centro tera o texto subindo.
