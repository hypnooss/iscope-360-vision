

# Espalhar Labels Horizontalmente pelo Espaco Disponivel

## Problema

Os labels estao posicionados a uma distancia fixa do centro do grafico (`outerRadius + 58px`), ignorando o espaco real disponivel no container. Isso faz com que os labels fiquem amontoados perto do grafico, especialmente no lado esquerdo onde costumam ter mais itens.

## Solucao

Passar as dimensoes do container (`width`, `height`) para o `OuterLabelsLayer` e posicionar os labels nos extremos do container (com uma margem), em vez de usar uma distancia fixa do centro do grafico. Isso garante que os labels usem toda a largura disponivel.

## Detalhe Tecnico

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

1. **Adicionar `width` e `height` as props** do componente
2. **Posicionar labels nos extremos do container**:
   - Labels da direita: X final = `width - margem` (ex: `width - 10`)
   - Labels da esquerda: X final = `margem` (ex: `10`)
   - Isso espalha os labels para as bordas do card
3. **Ajustar textAnchor**: labels da direita ficam `end` (texto cresce para a esquerda a partir da borda), labels da esquerda ficam `start` (texto cresce para a direita a partir da borda)
4. **Melhorar limites verticais**: usar `height` real em vez de `cy + outerRadius + 50` para calcular o espaco vertical disponivel para labels
5. **Centralizar verticalmente os grupos de labels** em torno do centro do grafico quando possivel

### Arquivo: `src/components/surface/SeverityTechDonut.tsx`

1. **Passar `width` e `height`** do container para `OuterLabelsLayer` via `<Customized>`:
   ```text
   <OuterLabelsLayer
     techData={techData}
     cx={props.width / 2}
     cy={props.height / 2}
     outerRadius={...}
     width={props.width}
     height={props.height}
   />
   ```

### Resultado esperado

- Labels do lado direito alinhados perto da borda direita do card
- Labels do lado esquerdo alinhados perto da borda esquerda do card
- Linhas conectoras se estendem do grafico ate a posicao do label na borda
- Espacamento vertical mantido com anti-colisao
- Melhor uso do espaco horizontal disponivel

