

# Reposicionar Labels do Donut: Sem Equalização, Sem Alinhamento Fixo

## Problema

1. O algoritmo atual tenta equalizar a quantidade de labels entre os lados esquerdo e direito, movendo labels de um lado para o outro. Isso causa labels no lado errado em relação à sua fatia.
2. Todas as labels de um mesmo lado ficam alinhadas em uma coluna fixa (definida pelo `EDGE_MARGIN`), criando linhas retas artificiais. Na verdade, cada label só precisa não sobrepor as outras.

## Solução

### 1. Remover a lógica de balanceamento
Eliminar todo o bloco `while (rightItems.length - leftItems.length > maxImbalance)`. Cada label fica no lado determinado puramente pelo cosseno do ângulo da fatia: `cos >= 0` vai para a direita, `cos < 0` vai para a esquerda. Se um lado tiver mais fatias, terá mais labels -- isso é correto.

### 2. Posicionar labels com X variável (não alinhados em coluna)
Em vez de usar um `EDGE_MARGIN` fixo para o ponto final da linha (ex3), calcular o X do label com base na extensão radial da linha, criando um layout mais orgânico:
- A linha sai da fatia (ex1, ey1), vai até um ponto de extensão (ex2, ey2), e depois vai horizontalmente até o texto
- O X final do texto será `ex2 + offset` (direita) ou `ex2 - offset` (esquerda), com um pequeno segmento horizontal
- Isso faz com que labels de fatias maiores (no topo) fiquem mais próximos, e labels de fatias menores fiquem onde precisam

### 3. Manter anti-colisão apenas no eixo Y
O algoritmo de `resolveCollisions` continua funcionando por grupo (esquerda/direita), garantindo que labels não se sobreponham verticalmente, mas sem forçá-los a uma posição X fixa.

## Detalhes Técnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

**Mudanças:**

1. **Remover linhas 50-85** (bloco de balanceamento `maxImbalance` e os dois `while` loops)

2. **Simplificar a divisão** -- manter apenas:
   ```
   const rightItems = allItems.filter(i => i.naturalSide === 'right');
   const leftItems = allItems.filter(i => i.naturalSide === 'left');
   ```

3. **Alterar `renderGroup`** para calcular X dinamicamente:
   - Definir um comprimento horizontal fixo para o segmento final (ex: `horizontalLen = 30`)
   - O ponto ex3 passa a ser `ex2 + horizontalLen` (direita) ou `ex2 - horizontalLen` (esquerda)
   - Aplicar um clamp para que ex3 não ultrapasse os limites do card (mínimo 10px de margem)
   - O texto fica posicionado a partir de ex3

4. **Manter** `EDGE_MARGIN` como fallback máximo -- se o X calculado ultrapassar `width - EDGE_MARGIN` ou ficar abaixo de `EDGE_MARGIN`, usar o limite

