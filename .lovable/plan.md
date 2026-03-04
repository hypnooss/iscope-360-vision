

## Add Inline Tabs to Schedules Page: "Agendamentos" + "Execuções"

### Overview

Add a `Tabs` component to `SchedulesPage` with two tabs:
1. **Agendamentos** — existing schedules content (moved into a `TabsContent`)
2. **Execuções** — new unified executions view showing `agent_tasks` across all target types

### Changes

**File**: `src/pages/admin/SchedulesPage.tsx`

1. **Wrap content in Tabs**: After the page title/breadcrumb, add `<Tabs defaultValue="schedules">` with `<TabsList>` containing two triggers: "Agendamentos" and "Execuções"

2. **Move existing content** (stat cards, filters, table, CVE section) into `<TabsContent value="schedules">`

3. **New `<TabsContent value="executions">`** containing a unified executions panel:

   - **Stats cards**: Same visual format as the schedules tab (Total, Pendentes, Executando, Concluídas, Falhas) — matching print 1 style
   
   - **Filters row** (same layout as schedules tab):
     - Search input ("Buscar ativo...")
     - Type selector: Todos os tipos / Firewall Compliance / Domain Compliance / Surface Analyzer / Firewall Analyzer / M365 Compliance
     - Workspace selector (from clients table)
     - Status selector: Todas / Pendente / Executando / Concluída / Falhou / Timeout / Cancelada
   
   - **Data query**: Fetch from `agent_tasks` table with:
     - No `target_type` filter (all types)
     - Join to `firewalls`, `external_domains`, `m365_tenants` for name resolution
     - Filter by workspace via the target's `client_id`
     - Default time window (last 24h) with time filter selector
     - Order by `created_at` desc, limit 200
   
   - **Table columns**: Tipo | Ativo | Workspace | Status | Agente | Duração | Criado em
     - Reuse `statusConfig` and `typeConfig` patterns from existing execution pages
     - Type badges match the schedule tab's `renderTypeBadge` style

4. **Extract shared components** within the file:
   - `renderTypeBadge` is already defined — reuse for both tabs
   - `statusConfig` map for execution status badges

The tabs will sit right below the page title, before the stat cards, so each tab has its own independent stat cards and filters.

