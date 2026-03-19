

## Plano: Implementar Glass Effect Real nos Cards

### Problema
Os cards usam `bg-card` (cor sólida `hsl(220 18% 10%)`). Cor sólida = 0% transparência = `backdrop-filter` não tem efeito visível.

### Solução
Trocar o background sólido por um semi-transparente e adicionar `backdrop-filter`.

### Alteração em `src/index.css`

**`.feature-card`** -- de sólido para glass:
```css
.feature-card {
  @apply rounded-xl border border-white/[0.06] p-7;
  background: hsl(220 18% 10% / 0.55);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 4px 24px hsl(220 20% 0% / 0.4);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.feature-card:hover {
  @apply border-primary/30;
  transform: translateY(-4px);
  box-shadow: 0 16px 48px hsl(175 80% 45% / 0.1), 0 0 0 1px hsl(var(--primary) / 0.12);
}
```

**`.glass-container`** -- mesmo tratamento:
```css
.glass-container {
  @apply rounded-xl border border-white/[0.06];
  background: hsl(220 18% 10% / 0.55);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 4px 24px hsl(220 20% 0% / 0.4);
}
```

**`.glass-card`** -- consistência:
```css
.glass-card {
  @apply border border-white/[0.06];
  background: hsl(220 18% 10% / 0.55);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 2px 12px hsl(220 20% 0% / 0.2);
}
```

### Por que vai funcionar agora
- Background com alpha 0.55 permite que o canvas WebGL atrás seja parcialmente visível
- `backdrop-filter: blur(16px)` desfoca o que está atrás, criando o efeito frosted glass
- `border-white/[0.06]` dá a borda sutil de vidro (como no mazehq)
- A reestruturação anterior do `Reveal` (removendo `transform` após animação) já garante que não há stacking context isolado bloqueando o blur

### Arquivo
- `src/index.css`

