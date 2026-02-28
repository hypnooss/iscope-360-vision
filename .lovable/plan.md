

## Plan: Add edit/delete actions to M365 tenant rows + Create M365 tenant edit page

### 1. Add edit/delete icons to M365 tenant table in EnvironmentPage

**`src/pages/EnvironmentPage.tsx`** (lines 358-365):
- Add `renderActions` to the M365 `AssetCategorySection`, matching the pattern used for firewalls and domains
- Edit icon navigates to `/environment/m365/{id}/edit`
- Delete icon opens a confirmation dialog (reuse `DeleteEnvironmentDomainDialog` or add a new state for M365 delete)
- Add delete handler for M365 tenants (delete from `m365_tenant_agents`, `m365_tenant_permissions`, `m365_tenants`)
- Update `navigationUrl` for m365 tenants to `/environment/m365/{id}/edit`

### 2. Create M365 tenant edit page

**New file: `src/pages/environment/M365TenantEditPage.tsx`**

Full-page edit screen inspired by the screenshot, with these sections:

- **Header**: Tenant name, domain, connection status badge
- **Info grid**: Workspace, Ultima Analise, Score, Agendamento
- **Permissions section** (collapsible): Reuse the permission categories/roles display from `TenantStatusCard`
- **Directory Roles (RBAC)**: Exchange Administrator, SharePoint Administrator
- **Action buttons at bottom**: Testar, Editar (opens `TenantEditDialog`), Revalidar Permissoes, Desconectar, Excluir, Analisar
- Fetch tenant data by ID from `m365_tenants`, permissions from `m365_tenant_permissions`, last analysis from `m365_posture_history`

### 3. Register route

**`src/App.tsx`**: Add route `/environment/m365/:id/edit` → `M365TenantEditPage`

