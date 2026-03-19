

## Plano: Restaurar visual original dos cards (fundo sólido + bordas)

O CSS atual dos `.feature-card` e `.glass-container` usa backgrounds transparentes com `backdrop-filter` que não funcionam corretamente fora do showcase. O print mostra cards com fundo sólido escuro e bordas sutis — o visual correto.

### Alteração em `src/index.css`

Restaurar `.feature-card` para fundo sólido:
```css
.feature-card {
  @apply rounded-xl border border-border/50 p-7;
  @apply bg-card;
  box-shadow: 0 4px 24px hsl(220 20% 0% / 0.4);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
```

Restaurar `.glass-container` para fundo sólido:
```css
.glass-container {
  @apply rounded-xl border border-border/50 bg-card;
  box-shadow: 0 4px 24px hsl(220 20% 0% / 0.4);
}
```

Remove os `backdrop-filter`, `linear-gradient` transparentes e `inset` shadows que foram adicionados nas tentativas de glass. Volta para `bg-card` sólido com `border-border/50` — exatamente o que aparece no print.

Hover do `.feature-card` mantém o efeito de elevação e borda primary.

**Arquivo:** `src/index.css`

