

## Problem

All tables in "Gestão de Ativos" (LicensingHubPage) use a bare `<div className="rounded-lg border border-border overflow-hidden">` wrapper, making them transparent. The "Ambiente" (EnvironmentPage) tables use `<Card><CardContent className="p-0">` which provides the proper solid `bg-card` background.

## Fix

In `src/pages/LicensingHubPage.tsx`, replace every table wrapper from:
```tsx
<div className="rounded-lg border border-border overflow-hidden">
  <Table>...</Table>
</div>
```
to:
```tsx
<Card>
  <CardContent className="p-0">
    <Table>...</Table>
  </CardContent>
</Card>
```

There are **4 occurrences** (lines ~392, ~456, ~496, ~569) — one per tab (Firewalls, TLS, Domínios, M365). `Card` and `CardContent` are already imported in the file.

