

# Fix: Status tooltip positioning (copy Technology column pattern)

## Problem
The Status column tooltip still renders in the wrong position. The Technology column tooltip works correctly because it uses a bare `<Tooltip>` without a local `<TooltipProvider>` wrapper, while the Status column wraps itself in its own `<TooltipProvider>`, causing positioning issues.

## Fix

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Remove the `<TooltipProvider>` wrapper from the Status tooltip (lines 378 and 393), keeping just the `<Tooltip>` component like the Technology column does.

```tsx
// Before (lines 377-394)
<TableCell className="text-center">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge ...>{row.ws.status_code}</Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">...</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</TableCell>

// After
<TableCell className="text-center">
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge ...>{row.ws.status_code}</Badge>
    </TooltipTrigger>
    <TooltipContent side="bottom">...</TooltipContent>
  </Tooltip>
</TableCell>
```

Single structural change: remove the two `TooltipProvider` lines (378 and 393). No other modifications needed.

