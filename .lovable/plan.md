

## Fix glass-card leaking into internal app pages

### Problem
The `.glass-card` CSS class uses ultra-transparent styling (`bg-white/[0.04]`, `backdrop-blur-xl`) designed for the landing page aesthetic. It's applied across **71 internal app files** (Firewall, M365, External Domain, etc.), making those cards nearly transparent against the dark app background — which looks wrong.

Meanwhile, the landing page uses separate classes (`glass-container`, `feature-card`) that already have the correct glass styling.

### Solution
**Single CSS change** — redefine `.glass-card` in `src/index.css` to use the standard card background (`bg-card`) with a subtle border, removing the ultra-transparency and backdrop-blur. This fixes all 71 files at once without touching any component.

```css
/* Before */
.glass-card {
  @apply bg-white/[0.04] backdrop-blur-xl border border-white/[0.08];
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05), 0 4px 24px hsl(220 20% 0% / 0.4);
}

/* After */
.glass-card {
  @apply bg-card border border-border/50;
  box-shadow: 0 2px 12px hsl(220 20% 0% / 0.2);
}
```

The landing page classes (`glass-container`, `feature-card`) remain untouched and keep their glass effect.

### Files to change
- `src/index.css` — redefine `.glass-card` (1 line change)

