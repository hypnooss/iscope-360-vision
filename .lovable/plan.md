

# Limit Technology Badges: 3 per row, max 2 rows, with hover tooltip

## What changes

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Technologies cell logic:**
- Display badges in a `flex flex-wrap` container with a fixed max height to enforce **3 badges per row, max 2 rows** (6 visible badges max).
- If there are **6 or more** technologies, show only the first **5** badges plus a `+N` overflow badge as the 6th.
- Wrap the entire technologies container in a **Tooltip** (from `@/components/ui/tooltip`) that shows **all** technology names on hover, so no information is lost.

**Implementation detail:**

```tsx
const MAX_VISIBLE = 5;
const hasOverflow = row.ws.technologies.length > MAX_VISIBLE;
const visible = hasOverflow ? row.ws.technologies.slice(0, MAX_VISIBLE) : row.ws.technologies;

<Tooltip>
  <TooltipTrigger asChild>
    <div className="flex flex-wrap gap-1 max-w-[320px] cursor-default">
      {visible.map((t, j) => (
        <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0 truncate max-w-[120px]", getTechBadgeColor(t))}>{t}</Badge>
      ))}
      {hasOverflow && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
          +{row.ws.technologies.length - MAX_VISIBLE}
        </Badge>
      )}
    </div>
  </TooltipTrigger>
  <TooltipContent side="top" className="max-w-sm">
    <div className="flex flex-wrap gap-1">
      {row.ws.technologies.map((t, j) => (
        <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0", getTechBadgeColor(t))}>{t}</Badge>
      ))}
    </div>
  </TooltipContent>
</Tooltip>
```

**Imports to add:**
- `Tooltip, TooltipTrigger, TooltipContent` from `@/components/ui/tooltip`

The tooltip only appears when there are technologies present. No tooltip is needed for the `---` empty state.

