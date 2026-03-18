

## Problem
The **Gestão de Ativos** page (`LicensingHubPage.tsx`) is missing the `PageBreadcrumb` component that exists on all other pages (e.g., Ambiente, Firewall, etc.).

## Fix
Add `PageBreadcrumb` to `LicensingHubPage.tsx`:

1. Import `PageBreadcrumb` from `@/components/layout/PageBreadcrumb`
2. Add `<PageBreadcrumb items={[{ label: 'Gestão de Ativos' }]} />` at the top of the page content, before the header section

This follows the exact pattern used in `EnvironmentPage.tsx`:
```tsx
<PageBreadcrumb items={[{ label: 'Ambiente' }]} />
```

Single file change: `src/pages/LicensingHubPage.tsx`.

