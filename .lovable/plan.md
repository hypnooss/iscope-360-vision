
# Corrigir Direcao do Texto Usando Posicao Real do Slice

## Problema
A variavel `textGoesDown` usa `ey3` (posicao Y apos resolucao de anti-colisao) para decidir a direcao do texto. Porem, a anti-colisao pode mover o `finalY` para acima do centro (`cy`), fazendo com que `textGoesDown` retorne `false` mesmo quando o slice ("Outros") esta claramente na metade inferior do grafico. Isso faz o texto "subir" em vez de "descer".

## Solucao
Usar `item.ey2` (a posicao Y calculada diretamente do angulo, sem anti-colisao) para determinar a direcao do texto. Essa posicao reflete o hemisferio REAL do slice no grafico. Tambem aumentar os offsets verticais para criar separacao visual mais clara entre o dot e o texto.

## Detalhes Tecnicos

### Arquivo: `src/components/surface/OuterLabelsLayer.tsx`

Na funcao `renderGroup` (linha 173), trocar:

```text
const textGoesDown = ey3 >= cy;
```

Por:

```text
const textGoesDown = item.ey2 >= cy;
```

Tambem aumentar os offsets para melhor separacao visual (linhas 181-182):

```text
const nameY = textGoesDown ? ey3 + 12 : ey3 - 22;
const valueY = textGoesDown ? ey3 + 25 : ey3 - 9;
```

Isso garante que:
- A direcao do texto e determinada pela posicao real do slice no grafico (angulo original), nao pela posicao resolvida apos anti-colisao
- O texto fica visivelmente separado do dot/bolinha, tanto para cima quanto para baixo
- "Outros" (embaixo do centro) tera texto descendo, "Bootstrap" (acima do centro) tera texto subindo
