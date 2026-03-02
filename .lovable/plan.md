

## Fix: M365 Compliance still shows loading spinner on navigation

### Root Cause
`useM365TenantSelector` uses `useState` + `useEffect` to fetch tenants. Every mount calls `loadTenants()` which sets `loading=true`, triggering the full-page spinner on line 184 of `M365PosturePage.tsx`. This is the same anti-pattern that was just fixed in the posture hook but remains in the tenant selector.

### Solution

**`src/hooks/useM365TenantSelector.ts`:**
- Replace `useState(tenants)` + `useEffect(loadTenants)` with `useQuery`
- Use `staleTime: 1000 * 60 * 5` (5 min) so navigating back uses cached tenants
- Include `workspaceId` in the `queryKey` so switching workspaces still re-fetches
- Derive `loading` from `isLoading` of the query (only true on first fetch, not on cache hit)

### Key change
```typescript
const { data: tenants = [], isLoading: loading } = useQuery({
  queryKey: ['m365-tenants', workspaceId, user?.id],
  queryFn: async () => { /* existing fetch logic */ },
  enabled: !!user,
  staleTime: 1000 * 60 * 5,
});
```

Everything else (URL param persistence, auto-select first tenant, `selectTenant`) stays the same.

