

## Remove glass effect from Command Center headers

### Problem
The Command Center headers on three compliance pages (External Domain, Firewall, M365) use a glass-like aesthetic with gradient backgrounds, grid pattern overlays, and glow effects. After the recent `.glass-card` fix to make internal cards opaque, these headers now look inconsistent.

### Solution
Update the shared `CommandCentralLayout` component and the two inline implementations to use standard `bg-card` styling with `border-border/50`, removing the gradient background, grid overlay, and blur glow behind the gauge.

### Changes

**1. `src/components/CommandCentral.tsx`** (used by Firewall + M365 Posture)
- Replace gradient `style` background with `bg-card`
- Remove the grid pattern overlay div
- Remove the blur glow div behind ScoreGauge
- Change border from `border-primary/20` to `border-border/50`

**2. `src/pages/external-domain/ExternalDomainCompliancePage.tsx`** (~lines 698-711)
- Same changes applied to the inline command center: remove gradient style, grid overlay, blur glow, use `bg-card border-border/50`

**3. `src/pages/m365/M365PostureReportPage.tsx`** (~lines 578-595)
- Same changes applied to this inline command center

All three will render as solid dark cards matching the rest of the app's opaque card style.

