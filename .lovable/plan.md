

# Differentiate the overflow badge from port badges

## Problem
The `+381` overflow badge looks identical to port number badges, making it appear as if `+381` is a port.

## Change

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Update the overflow badge styling to be visually distinct. Change it from `variant="secondary"` to a dashed-border outline style with muted text color and no monospace font, so it clearly reads as a "more" indicator rather than a port number.

```tsx
// Before
<Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">+{ports.length - MAX_PORTS}</Badge>

// After
<Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed text-muted-foreground">+{ports.length - MAX_PORTS}</Badge>
```

Key differences:
- Removes `font-mono` so it doesn't look like a port number
- Uses `border-dashed` to visually distinguish from the solid-border port badges
- Uses `text-muted-foreground` for a softer, secondary appearance

No other changes needed.
