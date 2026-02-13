
# Three changes in the Web Services table

## 1. Overflow badge styling (Technologies column)

Add `border-dashed` to the existing `+N` overflow badge (line 394) to match the style used in the Ports column.

```tsx
// Before (line 394)
<Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">

// After
<Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed text-muted-foreground">
```

## 2. Reduce Technologies column width

Reduce the container from `max-w-[220px]` to `max-w-[180px]` (line 389) to shrink the column and give more space to adjacent columns.

```tsx
// Before
<div className="flex flex-wrap gap-1 max-w-[220px] cursor-default">

// After
<div className="flex flex-wrap gap-1 max-w-[180px] cursor-default">
```

## 3. HTTP Status Code tooltip

Wrap the Status badge (lines 371-378) in a Tooltip that shows a human-readable description of the HTTP code on hover. A lookup map will be added with common codes:

- 200: OK
- 301: Moved Permanently
- 302: Found (Redirect)
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
- 502: Bad Gateway
- 503: Service Unavailable
- etc.

```tsx
const HTTP_STATUS_DESCRIPTIONS: Record<number, string> = {
  200: 'OK', 301: 'Moved Permanently', 302: 'Found (Redirect)',
  304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
  403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  500: 'Internal Server Error', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout',
};
```

The Status cell will be wrapped in a Tooltip showing the description (or "HTTP {code}" as fallback if the code is not in the map).

### Technical details

All changes are in `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`:
- Add `HTTP_STATUS_DESCRIPTIONS` constant near the top of the Web Services section
- Lines 371-378: wrap the Badge in a Tooltip with the description
- Line 389: change `max-w-[220px]` to `max-w-[180px]`
- Line 394: add `border-dashed` class
