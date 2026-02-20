

# Labels Externos com Linhas para o Anel de Tecnologias

## O que muda

O anel externo (Tecnologias) passa a exibir labels **fora do grafico**, conectados por linhas ao segmento correspondente — similar ao estilo do print de referencia. O anel interno (Severidade) mantem os labels dentro dos segmentos para porcoes grandes e tooltip para porcoes pequenas.

## Como funciona

Para o anel externo, usamos a prop `label` com uma funcao customizada que renderiza SVG com:
- Uma **linha** do centro do arco ate o ponto externo (polyline com 2 segmentos: radial + horizontal)
- Um **circulo colorido** pequeno (indicador)
- O **nome da tecnologia** em negrito
- **Valor + porcentagem** abaixo, em texto menor

Para segmentos muito pequenos (menos de ~4%), o label externo e suprimido para evitar sobreposicao — esses dados ficam acessiveis via tooltip.

O anel interno continua usando `renderCustomLabel` atual (texto dentro do segmento, threshold 10%).

## Detalhe Tecnico

**Arquivo:** `src/components/surface/SeverityTechDonut.tsx`

1. Criar funcao `renderOuterLabel` que recebe as props do recharts (`cx`, `cy`, `midAngle`, `outerRadius`, `name`, `value`, `percent`, `payload`) e retorna um grupo SVG `<g>` com:
   - `<path>` ou `<polyline>` do ponto no arco ate o label (segmento radial + segmento horizontal)
   - `<circle>` colorido como indicador
   - `<text>` com nome e valor/porcentagem
   - Posicionamento: labels a direita para angulos 0-180, a esquerda para 180-360 (textAnchor dinamico)
   - Offset horizontal de ~20px alem do outerRadius para dar espaco

2. No `<Pie>` externo (techData):
   - Trocar `label={renderCustomLabel}` por `label={renderOuterLabel}`
   - Manter `labelLine={false}` pois desenhamos a linha manualmente dentro do label

3. Aumentar levemente o `outerRadius` do anel externo para `"68%"` (de `"72%"`) para dar mais espaco aos labels externos, ou ajustar o container para ter mais margem

4. O anel interno (severityData) nao muda — continua com `renderCustomLabel` e threshold de 10%

5. Tooltip continua funcionando para **ambos** os aneis (hover mostra detalhes completos)

