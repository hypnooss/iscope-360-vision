

# Correcao: Ordem das Datas no Sparkline

## Problema

O eixo X do sparkline esta mostrando a data mais recente do lado esquerdo e a mais antiga do lado direito. Isso causa confusao visual, especialmente porque o "Score Atual" fica posicionado a direita do grafico.

## Solucao

Garantir que os dados sejam ordenados de forma ascendente (mais antigo -> mais recente) dentro do proprio componente `ScoreSparkline`, independente da ordem em que chegam do hook. Assim:

- **Lado esquerdo** do grafico = data mais antiga (inicio do periodo)
- **Lado direito** do grafico = data mais recente (ultima coleta), visualmente proximo ao "Score Atual"

## Alteracao

**Arquivo**: `src/components/dashboard/ScoreSparkline.tsx`

1. Ordenar os dados de forma ascendente por data no inicio do componente (garantia contra dados que venham em ordem diferente)
2. Manter os ticks como `[primeiro, ultimo]` do array ja ordenado, o que agora sera `[mais_antigo, mais_recente]`

Isso e uma alteracao de ~3 linhas: adicionar um `useMemo` que faz `.sort()` ascendente nos dados antes de usa-los no chart e nos ticks.

## Detalhe tecnico

```
sortedData = useMemo(() =>
  [...data].sort((a, b) => a.date.localeCompare(b.date)),
  [data]
);
```

Depois, substituir todas as referencias a `data` por `sortedData` no componente (gradientStops, ticks, e o prop `data` do AreaChart).

## Resultado visual

```
  14/01 ─────────────── 13/02   Score Atual
  (30 dias atras)      (ultima)    85/100
```

