

## Ajustar threshold das animações de entrada

### Problema
O `viewport.margin` está em `-100px`, o que significa que a animação dispara quando o elemento ainda está a 100px de entrar na tela. Com isso, ao rolar normalmente, o usuário já pega o final da animação (elementos quase no lugar).

### Solução
Aumentar o margin negativo para `-200px` (ou `-250px`), fazendo a animação só começar quando o elemento já estiver mais visível na viewport. Isso garante que o usuário veja o efeito completo.

### Alteração

**`src/pages/Index.tsx`** — duas ocorrências:

1. **`Section` component** (linha 69): trocar `margin: '-100px'` por `margin: '-200px'`
2. **`motion.div` do stagger** (linha 468): trocar `margin: '-100px'` por `margin: '-200px'`

Isso faz os elementos esperarem estar 200px dentro da viewport antes de animar, garantindo que o usuário veja a animação desde o início.

