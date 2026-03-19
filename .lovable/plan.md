

## Corrigir: animações não visíveis por threshold muito alto

### Problema
O `viewport.margin: '-200px'` exige que o elemento esteja 200px dentro da viewport para disparar. Somado ao padding de 160px das seções, o conteúdo precisa estar ~360px dentro da tela — quase metade da viewport de 856px. O resultado: o conteúdo aparece invisível (`opacity: 0`) por tempo demais e quando a animação finalmente dispara, o usuário já passou ou mal percebe.

### Solução
Reduzir o margin para `-80px` — dispara a animação logo que o elemento entra na viewport, garantindo que o usuário veja o efeito completo desde o início.

### Alterações

**`src/pages/Index.tsx`** — 2 pontos:

1. **Linha 69** (`Section` component): `margin: '-200px'` → `margin: '-80px'`
2. **Linha 468** (stagger `motion.div` dos testimonials/blog): `margin: '-200px'` → `margin: '-80px'`

Nenhuma outra alteração. Isso afeta todas as seções que usam `Section` e os containers com stagger inline.

