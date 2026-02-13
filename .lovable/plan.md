

# Dashboard: Subtitulo + Datas no Sparkline

## Alteracao 1 - Subtitulo

**Arquivo**: `src/pages/GeneralDashboardPage.tsx` (linha 402)

Trocar "Postura de Seguranca por Modulo" por "Postura de Compliance por Modulo".

## Alteracao 2 - Datas no eixo X do Sparkline

**Arquivo**: `src/components/dashboard/ScoreSparkline.tsx`

Atualmente o XAxis esta oculto (`hide`). Vamos mostrar apenas a primeira e a ultima data do dataset como labels no eixo X, formatadas como `DD/MM` (ex: `14/01` e `13/02`).

Implementacao:
- Aumentar a altura do sparkline de 40px para 56px para acomodar os labels
- Remover `hide` do XAxis e configurar:
  - `ticks={[data[0].date, data[data.length-1].date]}` para mostrar apenas inicio e fim
  - `tickFormatter` que converte `YYYY-MM-DD` para `DD/MM`
  - `tick={{ fontSize: 9, fill: muted color }}` 
  - `tickLine={false}`, `axisLine={false}`
- Ajustar margin bottom do chart para dar espaco ao label

Isso vai deixar claro o periodo que o grafico cobre (ex: `14/01 ─────── 13/02`) e explicar por que a ultima posicao do grafico pode ter cor diferente do "Score Atual" -- o grafico mostra a **media do dia**, enquanto o Score Atual e a media em tempo real de todos os ativos.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Subtitulo |
| `src/components/dashboard/ScoreSparkline.tsx` | Mostrar datas inicio/fim no eixo X |

