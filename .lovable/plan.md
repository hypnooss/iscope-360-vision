

## Fix: Prevent auto-refresh and gauge redraw on M365 Compliance

### Root Cause
`useM365SecurityPosture` uses raw `useState` + `useEffect` to fetch data. Every time the page mounts (navigating back), the effect fires, sets `isLoading=true` (clearing the UI), re-fetches from scratch, and the gauge redraws with animation. The Firewall and Domain pages use `useQuery` with `staleTime` — cached data is shown instantly without refetching.

### Solution

**`src/hooks/useM365SecurityPosture.ts`:**
- Replace the `useState(data)` + `useEffect(refetch)` pattern with `useQuery` for the posture data fetch
- Use `staleTime: 1000 * 60 * 5` (5 min) so navigating back doesn't trigger a refetch
- Keep `triggerAnalysis` as-is (imperative action)
- Expose `refetch` from the query for explicit refresh after analysis completes
- The `queryKey` includes `tenantRecordId` so switching tenants still loads the right data

**`src/pages/m365/M365PosturePage.tsx`:**
- After analysis completes (polling detects `completed`), call `queryClient.invalidateQueries` on the posture query key (same pattern as Firewall/Domain pages)
- Pass `skipGaugeAnimation={true}` to `CommandCentralLayout` when data is already cached (not first load)

### Result
- Navigating away and back: instant render from cache, no loading spinner, no gauge animation
- After analysis completes: data refreshes once via query invalidation
- Switching tenants: fetches new tenant data normally

