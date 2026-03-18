

## Plan: Align Exchange Analyzer layout with Compliance page

### Changes in `src/pages/m365/ExchangeAnalyzerPage.tsx`

**1. Reduce vertical spacing** (line 190)
- Change `space-y-10` → `space-y-6` to match Compliance

**2. Replace raw Select tenant selector with `TenantSelector` component** (lines 209-219)
- Remove the inline `<Select>` with `Mail` icon
- Import and use `TenantSelector` from `@/components/m365/posture` (same component used in Compliance)
- Pass `tenants`, `selectedId={selectedTenantId}`, `onSelect={selectTenant}`, `loading={tenantsLoading}`

**3. Add href to breadcrumb** (line 191)
- Add `href: '/scope-m365/dashboard'` to the "Microsoft 365" breadcrumb item to match Compliance

Single file change: `src/pages/m365/ExchangeAnalyzerPage.tsx`

