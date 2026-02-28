

## Plan: Remove scheduling UI from creation forms + Add M365 tenant wizard page

### 1. Remove scheduling UI from External Domain creation
**`src/pages/AddExternalDomainPage.tsx`**
- Remove the "Agendamento de Análise" Card UI (lines 340-426) — only the visual card, not the underlying types/helpers
- Remove schedule-related fields from `formData` state and the schedule insert logic from `handleSubmit` (lines 199-223)
- Remove unused imports (`Clock`, `Separator`) and constants (`HOURS`, `DAYS_OF_WEEK`, `DAYS_OF_MONTH`, `ScheduleFrequency`, `calculateNextRunAt`)

### 2. Remove Step 4 (Agendamento) from Firewall wizard
**`src/pages/environment/AddFirewallPage.tsx`**
- Remove step 4 from `STEPS` array (line 89), keeping only 3 steps: Fabricante, Instruções, Configuração
- Remove the entire Step 4 UI block (lines 1054-1150)
- Replace the "Próximo" button on Step 3 (line 1046) with the submit button (currently in Step 4)
- Remove schedule state variables and the schedule insert from `handleSubmit` (lines 504-516)
- Remove unused schedule constants (`HOURS`, `DAYS_OF_WEEK`, `DAYS_OF_MONTH`, `calculateNextRunAt`, `ScheduleFrequency`) and `Clock` import

### 3. Create M365 Tenant wizard page
**New file: `src/pages/environment/AddM365TenantPage.tsx`**
- Full page with `AppLayout`, breadcrumbs (Ambiente > Novo Item > Microsoft 365), back button, header
- Renders the `SimpleTenantConnectionWizard` as an always-open dialog (or extracts its form content inline)
- On success, navigates to `/scope-m365/tenant-connection`

### 4. Update routing
**`src/pages/AddAssetPage.tsx`** — Change M365 route from `/scope-m365/tenant-connection` to `/environment/new/m365`

**`src/App.tsx`** — Add route `/environment/new/m365` → `AddM365TenantPage` and lazy import

