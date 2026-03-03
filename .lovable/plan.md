

## Fix: M365 schedules not appearing on Administração > Agendamentos

**Root cause**: The query in `SchedulesPage.tsx` references `m365_tenants.tenant_name`, but the actual column is `display_name`. The Supabase join silently fails, returning no rows.

### Change

**File**: `src/pages/admin/SchedulesPage.tsx`, line 249 and 255

1. In the `.select()` string (line 249), change `tenant_name` to `display_name`:
   - From: `m365_tenants(id, tenant_name, client_id, clients(id, name))`
   - To: `m365_tenants(id, display_name, client_id, clients(id, name))`

2. In the mapping (line 255), change `s.m365_tenants?.tenant_name` to `s.m365_tenants?.display_name`

Two-word fix, single file.

