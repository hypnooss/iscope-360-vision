

## Plan: Convert M365 Tenant page from modal to inline wizard

The current `AddM365TenantPage` renders `SimpleTenantConnectionWizard` as a Dialog/modal. We need to convert it to a full-page wizard matching the firewall wizard layout pattern.

### Changes

**`src/pages/environment/AddM365TenantPage.tsx`** — Rewrite as a full-page wizard:
- Use the same layout as `AddFirewallPage`: `AppLayout` → breadcrumbs → back button + header → `StepIndicator` → step content in a `Card`
- Define 3 wizard steps: `Workspace` (select client), `Autenticação` (admin email + "Como funciona?" info + start consent), `Resultado` (success/error)
- Move all logic currently inside `SimpleTenantConnectionWizard` (client loading, agent linking, tenant discovery, OAuth flow, message listener) directly into this page component
- Footer buttons at the bottom of the card (Voltar/Próximo/Conectar/Concluir) following the firewall wizard pattern
- Navigation: back button and "Cancelar" go to `/environment/new`; "Concluir" on success goes to `/scope-m365/tenant-connection`

**No changes** to `SimpleTenantConnectionWizard.tsx` — it remains available for use elsewhere (e.g., TenantConnectionPage dialog).

### Step breakdown

| Step | Title | Content |
|------|-------|---------|
| 1 - Workspace | Select workspace | Client selector (same as current form top section) |
| 2 - Autenticação | Admin email + consent | Email input, "Como funciona?" card, "Conectar" button triggers OAuth popup |
| 3 - Resultado | Connection result | Spinner while authenticating → success/error display with "Concluir" |

