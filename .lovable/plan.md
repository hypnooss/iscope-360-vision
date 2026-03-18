

## Plan: Align Entra ID and Collaboration pages with Compliance layout

Both pages need to match the Compliance page pattern: breadcrumb → title+description row with actions → tenant selector inline in the header row (not inside a separate Card).

### File 1: `src/pages/m365/EntraIdPage.tsx` (lines 76-108)

Replace the current layout (breadcrumb + Card wrapping tenant selector + actions) with the Compliance pattern:

1. **Breadcrumb** stays as-is (already correct with href)
2. **Add title row** with `h1` "Entra ID" + description + action buttons (Exportar, Abrir no Entra ID, Atualizar) — using `flex md:items-center md:justify-between` like Compliance
3. **Move TenantSelector** into the title row's right side alongside the action buttons, removing the wrapping Card entirely
4. Remove the Card with `border-primary/20 bg-card/80` that currently wraps the tenant selector, badge, and timestamp

### File 2: `src/pages/m365/CollaborationPage.tsx` (lines 76-115)

Currently has: breadcrumb → title row with actions → separate Card with tenant selector. Merge to match Compliance:

1. **Breadcrumb** stays as-is
2. **Title row** keeps h1 "Colaboração" + description + actions — move TenantSelector into the right-side actions area
3. **Remove the separate Card** (`border-primary/20 bg-primary/5`) that wraps TenantSelector + badge + timestamp

Both pages will follow the same structure:
```text
Breadcrumb
Title + Description          [TenantSelector] [Actions...]
```

Font sizes match Compliance: `text-2xl font-bold` for title, `text-muted-foreground` for description.

