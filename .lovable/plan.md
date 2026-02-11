

# Corrigir cores HSL do sparkline para coincidir com a barra de progresso

## Problema

As cores do sparkline nao batem com as da barra de Score porque os valores HSL em `getScoreHslColor` estao incorretos em relacao as cores reais do Tailwind usadas em `getScoreProgressColor`.

Exemplo: a barra usa `bg-emerald-400` que e `#34d399`, mas o sparkline usa `hsl(142, 71%, 45%)` que resulta numa cor diferente.

## Solucao

Corrigir os valores HSL em `getScoreHslColor` para corresponder exatamente as cores Tailwind:

| Faixa | Tailwind class | Hex real | HSL correto |
|---|---|---|---|
| >= 90 | `bg-primary` | CSS var | `hsl(175, 80%, 45%)` (sem mudanca) |
| >= 75 | `bg-emerald-400` | `#34d399` | `hsl(158, 64%, 52%)` |
| >= 60 | `bg-yellow-500` | `#eab308` | `hsl(48, 96%, 53%)` (sem mudanca) |
| < 60 | `bg-rose-400` | `#fb7185` | `hsl(351, 95%, 72%)` |

## Arquivo

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Ajustar 2 valores HSL em `getScoreHslColor` (linhas 69 e 71) |

