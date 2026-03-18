

## Plano: Novo `ScrollDownIndicator` baseado em alinhamento de seção

### Resumo
Substituir `ScrollDown.tsx` (baseado em scrollY + slots) por `ScrollDownIndicator.tsx` com detecção de alinhamento via `getBoundingClientRect` e debounce de scroll-stop.

### Arquivos

**1. Criar `src/components/landing/ScrollDownIndicator.tsx`**

Lógica:
- Estado único: `isVisible` (boolean). Sem estado para "próxima seção".
- **On mount**: `requestAnimationFrame` → `checkAlignment()`
- **Scroll/wheel/touchmove listeners**: `setIsVisible(false)` imediatamente + resetar debounce timer (100ms)
- **Quando timer dispara** (`checkAlignment`):
  - `document.querySelectorAll('[data-section]')`
  - Para cada: `Math.abs(rect.top) < 5` → alinhado
  - Seções altas (400vh): também considerar `rect.top < 5 && rect.bottom > window.innerHeight`
  - Se alinhado → `setIsVisible(true)`
- **Click handler** (sem estado de nextSection):
  - `setIsVisible(false)`
  - Buscar todas `[data-section]`, encontrar a atualmente alinhada
  - Pegar a próxima no array → `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- **Cleanup**: remover todos os listeners + clearTimeout
- Visual: mesmo estilo atual (texto "Scroll down" + dot animado), `opacity` transition 300ms

**2. Editar `src/pages/Index.tsx`**
- Trocar import `ScrollDown` → `ScrollDownIndicator`
- Remover `scrollSlots` array
- Substituir `<ScrollDown slots={scrollSlots} />` por `<ScrollDownIndicator />`
- Adicionar `data-section` ao componente `Section` (no `motion.section`)

**3. Editar função `Section` em `Index.tsx`**
- Adicionar `data-section` ao `<motion.section>`:
```tsx
<motion.section id={id} data-section ...>
```

**4. Editar `src/components/landing/SteppedShowcase.tsx`**
- Adicionar `data-section` ao `<section>` wrapper do showcase
- Remover âncoras artificiais (`showcase-step-1-end`, etc.) se existirem

**5. Remover `src/components/landing/ScrollDown.tsx`** (obsoleto)

### Comportamento final
```
PAGE LOAD → rAF → checkAlignment → hero alinhado? → show
SCROLL/WHEEL/TOUCH → hide immediately → reset 100ms timer
TIMER FIRES → checkAlignment → aligned? show : stay hidden
CLICK → hide → find current aligned → get next → scrollIntoView
```

