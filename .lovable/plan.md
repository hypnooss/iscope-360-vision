

## Plano: Background visível em todas as seções + Glass nos cards da landing

### Problema 1: Background some após a primeira seção
O `NetworkAnimation` é `fixed inset-0` mas no tick loop (linha ~282 do componente), há um corte: `if (scrollProgress < 1.8)` que para de renderizar. Além disso, a câmera sobe e rotaciona durante o morph, fazendo as partículas saírem do viewport. Vou:

- Remover o cutoff de `scrollProgress < 1.8`
- Ajustar a câmera no modo terreno para manter partículas visíveis em todo o scroll (reduzir o deslocamento Y da câmera e aumentar o spread do terreno)

### Problema 2: Cards sem glass effect
Os cards da landing usam `glass-container` (definido no CSS como `bg-card/60 backdrop-blur-2xl border border-border/30 rounded-xl`). Isso já é glass. O problema pode ser que o `backdrop-blur` não funciona bem sem conteúdo atrás (o background de partículas some).

Se o background ficar visível em todas as seções (fix 1), o glass automaticamente aparecerá melhor. Mas os cards da seção "Como resolve" (linhas 298-306) e "Features" (`feature-card`) não usam `glass-container`. Vou unificar:

- Seção "Como resolve" (step cards): adicionar `glass-container` nos cards
- Seção "Features": o `feature-card` já tem `bg-card/50 backdrop-blur-xl` — está ok
- Seção CTA: sem card, não precisa

### Arquivos alterados
1. **`src/components/NetworkAnimation.tsx`** — remover cutoff de render, ajustar câmera/terreno para cobertura total
2. **`src/pages/Index.tsx`** — adicionar `glass-container` nos step cards de "Como resolve"

