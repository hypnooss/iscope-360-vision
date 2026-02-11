
# Dashboard - Sparkline em Linha com Score e Cores Dinamicas

## O que muda

O layout atual coloca um sparkline em barras ocupando a largura toda, com uma barra de progresso horizontal abaixo. O novo layout:

1. **Sparkline em linha** (nao barras) ocupando ~60% da largura
2. **Score Atual + valor** ao lado direito do sparkline (~40%)
3. **Cores dinamicas por segmento**: a linha muda de cor conforme o valor do score naquele ponto, criando um efeito de degradê entre as faixas

### Layout visual

```text
[  Sparkline em Linha (60%)  ] [ SCORE ATUAL  ]
[  ~~~~~~~~~~~~~~~~~~~~~~~~  ] [     81/100   ]
```

A barra de progresso horizontal sera removida.

### Cores dinamicas do sparkline

Sim, e possivel. Usando SVG `linearGradient` com `offset` calculado dinamicamente, cada segmento da linha assume a cor correspondente ao valor do score naquele ponto:

| Score | Cor |
|---|---|
| >= 90 | Primary/Teal (hsl 175) |
| >= 75 | Emerald-400 |
| >= 60 | Yellow/Warning |
| < 60 | Rose-400 |

A tecnica usa um gradiente SVG vertical onde os "stops" correspondem aos limiares de score mapeados para posicoes Y no grafico. Cada ponto do grafico que cruza um limiar faz a linha transitar suavemente para a cor daquela faixa.

Na pratica, como os dados sao pontos discretos (1 por dia), o efeito sera: cada segmento da linha tera a cor da faixa do score daquele dia, com transicao suave entre segmentos adjacentes de cores diferentes.

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/components/dashboard/ScoreSparkline.tsx` | Converter de BarChart para LineChart/AreaChart com gradiente dinamico por valor. Remover preenchimento de barras. |
| `src/pages/GeneralDashboardPage.tsx` | Reorganizar o bloco "Sparkline + Score" para layout horizontal (sparkline a esquerda, score a direita). Remover a barra de progresso. |

## Detalhes tecnicos

### ScoreSparkline.tsx

- Trocar `BarChart` + `Bar` por `AreaChart` + `Area` (area com fill transparente, apenas stroke visivel)
- Definir um `<defs><linearGradient>` com stops calculados a partir dos dados: para cada ponto, mapear a posicao X proporcional ao offset do gradiente e atribuir a cor correspondente ao valor do score
- O gradiente e horizontal (da esquerda para direita), acompanhando a linha temporal
- `stroke` usa `url(#sparkGradient)`, `fill` e `none` ou um fill muito suave

### GeneralDashboardPage.tsx (bloco ~linhas 190-218)

- Substituir o `space-y-0` por um `flex items-center gap-3`
- Sparkline ocupa `flex-1` (lado esquerdo)
- Score ocupa `shrink-0` (lado direito) com label "SCORE ATUAL" em cima e valor "81/100" embaixo
- Remover a barra de progresso (`Progress` / div com width percentage)
