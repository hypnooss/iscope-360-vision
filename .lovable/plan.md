
# Padronizar cor do sparkline com a barra de Score

## Mudancas

### 1. Sparkline usa a mesma cor da barra de Score (baseada no valor)

Atualmente o sparkline usa uma cor fixa por modulo (laranja para firewall, azul para M365, etc). A barra de Score usa cor dinamica baseada no valor (primary >= 90, emerald >= 75, yellow >= 60, rose < 60).

A mudanca e: remover o `SPARKLINE_COLOR_MAP` e passar ao `ScoreSparkline` a cor derivada do score atual, usando a mesma logica de `getScoreProgressColor` mas em formato HSL para o recharts.

Nova funcao auxiliar:
```
function getScoreHslColor(score: number | null): string {
  if (score == null) return 'hsl(0, 0%, 50%)';
  if (score >= 90) return 'hsl(175, 80%, 45%)';   // primary
  if (score >= 75) return 'hsl(142, 71%, 45%)';   // emerald-400
  if (score >= 60) return 'hsl(48, 96%, 53%)';    // yellow-500
  return 'hsl(347, 77%, 50%)';                     // rose-400
}
```

No `ModuleHealthCard`, substituir `sparkColor` por `getScoreHslColor(health.score)`.

### 2. Texto "Score" muda para "Score Atual"

Na linha 192, trocar `Score` por `Score Atual`.

## Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Remover `SPARKLINE_COLOR_MAP`; adicionar `getScoreHslColor`; usar no sparkline; trocar texto "Score" para "Score Atual" |
