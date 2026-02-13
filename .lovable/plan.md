

# Fix: Limit to 2 badges per row

## Problem
The container `max-w-[320px]` is wide enough to fit 3 badges on one row. We need to constrain it so only 2 badges fit per row.

## Change

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Reduce the container max-width from `max-w-[320px]` to `max-w-[220px]` on line 389. This will force the flex-wrap to break after every 2 badges, resulting in:

- **Row 1**: badge, badge
- **Row 2**: badge, +N (when 4+ technologies)

```
// Line 389
// Before
<div className="flex flex-wrap gap-1 max-w-[320px] cursor-default">

// After
<div className="flex flex-wrap gap-1 max-w-[220px] cursor-default">
```

No other changes needed. The `MAX_VISIBLE = 3` stays the same since we want 3 visible badges + the overflow badge as the 4th item.

