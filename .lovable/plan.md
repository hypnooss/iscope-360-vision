

## Add Workspace Selector to M365 Compliance Page

### Problem
The M365 Compliance page (`M365PosturePage.tsx`) is missing the Workspace selector that exists in Firewall and External Domain Compliance pages. Super roles (`super_admin`, `super_suporte`) need to filter tenants by workspace.

### Solution

**`src/pages/m365/M365PosturePage.tsx`:**

1. Import `useEffectiveAuth`, `useWorkspaceSelector`, and `Select` components
2. Add workspace query (same `clients-list` pattern as Firewall Compliance)
3. Add `useWorkspaceSelector` hook with localStorage persistence
4. Filter the tenant list by `selectedWorkspaceId` — pass it to `useM365TenantSelector`
5. Render the workspace `<Select>` dropdown before the TenantSelector in the header (only for super roles)

**`src/hooks/useM365TenantSelector.ts`:**

6. Add optional `workspaceId` parameter to filter tenants by `client_id` (same column used in the existing `workspaceIds` preview logic)
7. When `workspaceId` changes, re-fetch tenants and auto-select the first one

### Header layout (super role view)
```
[Workspace ▼] [Tenant ▼] [Executar Análise] [⚙]
```

### Persistence behavior
- Workspace: saved in `localStorage` via `useWorkspaceSelector` (key: `iscope_selected_workspace`)
- Tenant: saved in URL via `?tenant=` param (existing behavior from `useM365TenantSelector`)
- When workspace changes → tenant list re-filters → auto-selects first tenant of new workspace

