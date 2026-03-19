

## Problema

O `SteppedShowcase` usa `sticky top-[72px]` dentro de um container de `400vh`. Como as seções não têm background opaco, o conteúdo sticky do Showcase fica visível "por baixo" da seção Features enquanto o usuário ainda está nela — os ícones que aparecem na parte inferior da tela são do SteppedShowcase vazando para cima.

## Solução

Adicionar `relative z-10` ao componente `Section` para que as seções normais fiquem empilhadas visualmente acima do conteúdo sticky do SteppedShowcase. Também adicionar um background semi-opaco às seções para cobrir o conteúdo sticky por trás.

## Alterações

**`src/pages/Index.tsx`** — Componente `Section` (linha 71):
- De: `py-[160px] px-6 overflow-hidden ${className}`
- Para: `py-[160px] px-6 overflow-hidden relative z-10 ${className}`

**`src/components/landing/SteppedShowcase.tsx`** — Container outer (linha 377):
- Adicionar `z-0` à section: `className="relative z-0"`

Isso garante que as seções normais (z-10) cubram visualmente o conteúdo sticky do SteppedShowcase (z-0).

