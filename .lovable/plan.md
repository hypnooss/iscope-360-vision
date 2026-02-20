

# Simplificar Labels: Linha Reta + Labels nos Lados

## Objetivo

Substituir as polylines com cotovelo por linhas retas simples, e posicionar todos os labels nos lados esquerdo e direito do grafico (onde ha mais espaco), evitando as areas de cima e de baixo.

## Como funciona

Cada fatia do anel externo tera:
1. Uma **linha reta** da borda da fatia ate um ponto mais afastado na mesma direcao radial
2. Uma **bolinha** no final da linha
3. O **texto** (nome + valor) posicionado ao lado da bolinha

Para garantir que os labels fiquem nos lados (esquerdo/direito), o texto sera ancorado horizontalmente:
- Fatias do lado direito do grafico: texto a direita da bolinha
- Fatias do lado esquerdo: texto a esquerda da bolinha

Os labels de cima e de baixo naturalmente ja caem mais para os lados por causa da extensao radial, mas o algoritmo de anti-colisao vai redistribuir verticalmente apenas dentro das colunas esquerda e direita (2 grupos em vez de 4 quadrantes).

## Detalhe Tecnico

**Arquivo: `src/components/surface/OuterLabelsLayer.tsx`**

Reescrever o componente com logica simplificada:

- Remover a interface `SidedItem` com campos `ex2`, `ey2`, `isBottom` (nao mais necessarios)
- Para cada fatia, calcular apenas 2 pontos:
  - `startX/Y` = ponto na borda do anel externo (outerRadius)
  - `endX/Y` = ponto estendido (outerRadius + EXT_LEN, ~50px) na mesma direcao radial
- Agrupar em apenas **2 grupos** (direita e esquerda) baseado em `endX >= cx`
- Algoritmo de anti-colisao simplificado: espaçar verticalmente dentro de cada grupo (direita/esquerda)
- Renderizar: `<line>` em vez de `<polyline>`, `<circle>` no ponto final, texto ao lado
- Texto sempre empilhado verticalmente (nome em cima, valor embaixo), posicionado ao lado da bolinha com offset horizontal fixo

