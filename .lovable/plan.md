

# Reduce visible badges: 2 per row, max 3 visible + overflow

## Change

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Single change in the technologies cell: reduce `MAX_VISIBLE` from `5` to `3`.

- This means: show up to 3 badges, and if there are 4+ technologies, show the first 3 plus a `+N` overflow badge as the 4th.
- With `max-w-[320px]` and badge widths, this naturally results in ~2 badges per row, 2 rows max (3 badges + 1 overflow = 4 items across 2 rows).
- The tooltip remains unchanged -- hovering still shows all badges.

```tsx
// Before
const MAX_VISIBLE = 5;

// After
const MAX_VISIBLE = 3;
```

No other changes needed.

