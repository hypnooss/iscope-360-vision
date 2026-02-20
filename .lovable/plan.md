

# Corrigir Overflow das Labels do Donut

## Problema
A label "HTTP" (e potencialmente outras no lado esquerdo) extrapola os limites do card porque:
1. O container SVG nao tem clipping ativado -- conteudo que ultrapassa o viewBox fica visivel
2. O `MARGIN` de 10px e insuficiente: o ponto (dot) fica em x=10, o texto comeca em x=4 (`ex3 - 6`), mas como o `textAnchor` e `end`, o texto renderiza para a ESQUERDA de x=4, saindo do SVG

## Solucao
1. Adicionar `overflow-hidden` no container do grafico para que qualquer conteudo que ultrapasse seja cortado
2. Aumentar a margem lateral e reduzir o comprimento da linha horizontal para manter as labels dentro dos limites

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

- Aumentar `MARGIN` de 10 para 60 -- garante espaco para o texto nao ultrapassar a borda
- Reduzir `HORIZONTAL_LEN` de 30 para 20 -- linhas horizontais mais curtas para economizar espaco lateral

### Arquivo: `src/components/surface/SeverityTechDonut.tsx`

- Adicionar `overflow-hidden` na div container do grafico (`min-h-[380px]`) para garantir que mesmo se algo ultrapassar, o card corta o excesso

