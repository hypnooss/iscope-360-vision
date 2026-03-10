

## Plan: Standardize Firewall Fullscreen Top Bar

Replace the current "Voltar" ghost button + right-aligned info in `AttackMapFullscreen.tsx` with a header bar matching the Entra ID pattern:

### Changes in `src/components/firewall/AttackMapFullscreen.tsx`

1. **Replace the top bar** (lines 105-125) — swap the `absolute` overlay with a proper flex row with `border-b border-border`, matching Entra ID's style:
   - Left side: Title **"Firewall — Mapa de Conexões"**
   - Right side: X (close) button instead of "Voltar"
   
2. **Remove** the `ArrowLeft` import (no longer needed)

3. **Adjust layout**: Change from `absolute` top bar to a normal flow `div` with `p-4 border-b border-border` so the map sits below it (same as Entra ID). The map `flex-1` area will naturally fill below.

4. **Keep** firewallName and lastAnalysis info — move them next to the title as subtitle text.

### Visual result
```text
┌──────────────────────────────────────────────────┐
│ Firewall — Mapa de Conexões  (name • date)   [X]│  ← border-b
│                                                  │
│                    MAP                           │
│                                                  │
│              [bottom stats bar]                  │
└──────────────────────────────────────────────────┘
```

Single file change, no impact on map rendering or other components.

