

## Plano: Scroll Down navega entre etapas do Showcase

### Problema
O Showcase é um único `data-section` de 400vh. O ScrollDownIndicator pula direto para a próxima seção após ele.

### Solução
Substituir o `data-section` único do Showcase por 3 marcadores invisíveis — um para cada etapa — posicionados nas fronteiras de scroll de cada step.

### Alterações

**`src/components/landing/SteppedShowcase.tsx`**
- Remover `data-section` do `<section>` principal (linha 377)
- Adicionar 3 `<div data-section>` absolutos dentro do container de 400vh, posicionados em `top: 0`, `top: 133.33vh`, `top: 266.66vh` (correspondendo aos steps 01, 02, 03)
- São divs invisíveis (height: 0 ou 1px), servem apenas como âncoras de detecção

```text
400vh container (position: relative)
├── div[data-section] @ top: 0          ← step 01
├── div[data-section] @ top: 133.33vh   ← step 02  
├── div[data-section] @ top: 266.66vh   ← step 03
├── sticky content (ProgressBar + cards)
```

Quando o usuário scrolla até o step 01, o marcador do step 01 tem `rect.top ≈ 0` → indicador aparece. Click → `scrollIntoView` no marcador do step 02. No step 03, o próximo `data-section` no DOM será a seção "O que nossos clientes dizem".

**Nenhuma alteração** no `ScrollDownIndicator.tsx` — a lógica existente de `alignedTop` já detecta elementos com `rect.top < 15px` e navega para o próximo `data-section` no DOM.

