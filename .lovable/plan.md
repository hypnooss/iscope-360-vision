

## Problem

The `TenantSelector` on the M365 Compliance page is disabled in View Mode because it receives `disabled={isBlocked}`, where `isBlocked` comes from `usePreviewGuard()`. The preview guard is meant to block **mutating actions** (create, edit, delete), but switching tenants is a **read-only navigation action** and should remain enabled.

Additionally, the `loading` prop is set to `isLoading` (the posture data loading state), which could also lock the selector while data loads.

## Fix

**File: `src/pages/m365/M365PosturePage.tsx`** (line ~560)

Change the `TenantSelector` props:
- Remove `disabled={isBlocked}` — tenant selection is not a mutating action
- Keep `loading={tenantsLoading}` (only disable while tenants themselves are loading, not while posture data loads)

```tsx
// Before
<TenantSelector
  tenants={tenants}
  selectedId={selectedTenantId}
  onSelect={selectTenant}
  loading={isLoading}
  disabled={isBlocked}
/>

// After
<TenantSelector
  tenants={tenants}
  selectedId={selectedTenantId}
  onSelect={selectTenant}
  loading={tenantsLoading}
/>
```

This ensures the selector is only disabled while tenant data is being fetched, and remains usable in both normal mode and View Mode for workspaces with multiple tenants.

