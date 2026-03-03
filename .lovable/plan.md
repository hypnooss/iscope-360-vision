

## Add M365 Compliance to Schedules page

**File**: `src/pages/admin/SchedulesPage.tsx`

### Changes needed

1. **Type**: Add `'m365_compliance'` to the `targetType` union on `UnifiedSchedule` (line 47)

2. **Data fetch**: Add a new `useQuery` block to fetch `m365_analyzer_schedules` with a join to `m365_tenant_configs` → `clients`, similar to the existing firewall/domain queries. Map each row to a `UnifiedSchedule` with `targetType: 'm365_compliance'`.

3. **Merge**: Include the new M365 schedules in the `schedules` memo (line 244-252) and in `isLoading` (line 242). Add its `refetch` to `handleRefresh`.

4. **Filter dropdown**: Add `<SelectItem value="m365_compliance">M365 Compliance</SelectItem>` after line 504.

5. **Badge renderer**: Add a case for `m365_compliance` in `renderTypeBadge` (line 356) — blue/indigo badge with `Database` icon and label "M365 Compliance", consistent with the design standard (no decorative icons beyond the small lucide icon).

6. **Task status**: Add `'m365_compliance'` to the `target_type` filter in the `latestTasks` query (line 266) so last execution status is shown.

Single-file change, ~40 lines added.

