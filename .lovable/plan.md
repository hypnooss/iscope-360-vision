
## Changes

### 1. Remove glass effect from DNS Map card (`src/components/external-domain/DNSMapSection.tsx`)
- Replace gradient `style` background with `bg-card`
- Remove grid pattern overlay div
- Change border from `border-primary/20` to `border-border/50`

### 2. Remove "problemas críticos encontrados" banner (`src/components/Dashboard.tsx`)
- Delete lines 204-221 (the Critical Issues Banner block) from the Firewall Compliance dashboard
