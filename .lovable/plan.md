

# Fix: Web Services Table - Row Height and Technology Tags Layout

## Problem
The "Tecnologias" column with many tags (e.g., HSTS, Nextcloud, Nginx, PHP:8.3.27) causes the URL column to be squeezed. When there are few tags, it looks fine; with many, the layout breaks.

## Changes

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Increase minimum row height**
- Add `min-h-[48px]` to each `TableRow` to ensure consistent vertical spacing.

**2. Limit Technologies column to 2 tags per line with max-width**
- Set a `max-w-[180px]` on the Technologies `TableCell`.
- Change the flex container from `flex-wrap` to a grid layout with `grid grid-cols-2 gap-1`, ensuring exactly 2 tags per row.
- If more than 4 technologies exist, show the first 4 and display a "+N" badge for the rest (overflow indicator).

**3. Give URL column more breathing room**
- Increase URL column `max-w` from `220px` to `260px`.

### Implementation Detail

Technologies cell changes from:
```jsx
<div className="flex flex-wrap gap-1">
  {row.ws.technologies.map((t, j) => (
    <Badge key={j} ...>{t}</Badge>
  ))}
</div>
```

To:
```jsx
<div className="grid grid-cols-2 gap-1 max-w-[180px]">
  {row.ws.technologies.slice(0, 4).map((t, j) => (
    <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 truncate max-w-[85px]">{t}</Badge>
  ))}
  {row.ws.technologies.length > 4 && (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
      +{row.ws.technologies.length - 4}
    </Badge>
  )}
</div>
```

This ensures:
- Exactly 2 tags per row, keeping column width predictable
- Long technology names are truncated
- Overflow is indicated with a "+N" count
- URL column gets consistent space regardless of tech count

