

# Fix: Status tooltip position in Web Services table

## Problem
The HTTP status code tooltip appears far from the badge (top-left corner of the page) instead of next to the status value. This happens because the default tooltip position (`top`) misbehaves in scrollable table contexts.

## Fix

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Add `side="bottom"` to the `TooltipContent` on line 389 so the tooltip renders directly below the status badge:

```tsx
// Before (line 389)
<TooltipContent>

// After
<TooltipContent side="bottom">
```

Single-line change, no other modifications needed.

