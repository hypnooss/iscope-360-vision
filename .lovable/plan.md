

## Plano: Tornar o efeito glass visível nos cards

### Problema
A classe `glass-container` usa `bg-card/60` — card color (`hsl(220 18% 10%)`) com 60% de opacidade. Sobre o fundo escuro (`hsl(220 20% 7%)`), a diferença de cor é mínima, então o glass parece sólido. O `backdrop-blur` não tem conteúdo visível para borrar.

### Solução

**1. Reduzir opacidade do background dos cards** no `glass-container` (index.css):
- Mudar de `bg-card/60` para `bg-card/30` ou `bg-white/[0.04]`
- Adicionar borda mais visível com leve brilho (`border-white/10`)
- Adicionar `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]` para efeito de luz no topo

**2. Garantir que as partículas sejam visíveis atrás dos cards**:
- Verificar se o terreno de partículas tem spread suficiente e brilho para ser perceptível sob o blur

### Alteração principal no CSS (`src/index.css`):
```css
.glass-container {
  @apply bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl;
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05), 0 8px 32px hsl(220 20% 0% / 0.5);
}
```

Isso torna os cards semi-transparentes com o efeito glass real — as partículas serão sutilmente visíveis através do card com blur.

### Arquivos alterados
1. **`src/index.css`** — redefinir `.glass-container` com opacidade menor e bordas mais claras

