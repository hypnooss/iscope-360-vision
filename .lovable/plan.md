

# Badges coloridas individuais + barra proporcional para Web Filter, App Control e Anomalias

## O que muda

Atualmente as badges dessas 3 categorias usam todas a mesma cor (a cor da categoria), e a barra é uma barra sólida de severidade. O pedido é:

1. **Cada badge com cor própria** — uma paleta de cores distintas para cada top label (similar ao screenshot: verde, laranja, roxo, etc.)
2. **Barra proporcional** — igual aos cards de Tráfego, a barra mostra segmentos proporcionais ao `count` de cada top categoria

## Alterações em `AnalyzerCategoryGrid.tsx`

### 1. Mudar `topLabels` para `topItems` com count

No `CategoryStats`, trocar `topLabels?: string[]` por `topItems?: { label: string; count: number }[]`.

Nos cases `web_filter`, `app_control` e `anomalies`, popular com `.slice(0, 3).map(c => ({ label: c.category, count: c.count }))`.

### 2. Paleta de cores para segmentos

Definir um array de cores fixas para indexar cada item:
```ts
const SEGMENT_COLORS = ['#f97316', '#a855f7', '#10b981', '#3b82f6', '#eab308'];
```

### 3. Barra proporcional

Quando `topItems` existe e tem dados, renderizar a barra como `flex` com segmentos proporcionais (cada segmento com width baseado em `item.count / total * 100%` e a cor do índice).

### 4. Badges com cores individuais

Cada badge usa a cor do seu índice na paleta (backgroundColor, color, borderColor) em vez da cor única da categoria.

