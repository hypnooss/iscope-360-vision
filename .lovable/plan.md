

## Problem

The Schedules page (`/schedules`) already fetches M365 schedules from `m365_analyzer_schedules`, but labels them all as **"M365 Compliance"**. There is no **"M365 Analyzer"** type in the filter dropdown or badge system. This makes it impossible to distinguish M365 Analyzer schedules, and the `m365_analyzer` task type also maps to `m365_compliance` in the Executions tab.

Additionally, the `latestTasks` query for the Schedules tab filters by `target_type: 'm365_compliance'` but M365 Analyzer tasks use `target_type: 'm365_tenant'`, so their last execution status never shows up.

## Plan

### 1. Add `m365_analyzer` as a new TargetType

Update the `TargetType` union and `UnifiedSchedule` interface to include `'m365_analyzer'`.

### 2. Re-label existing M365 schedules

Change the `m365Schedules` query mapping from `targetType: 'm365_compliance'` to `targetType: 'm365_analyzer'` (since the table is `m365_analyzer_schedules`).

### 3. Add badge for M365 Analyzer

Add a new branch in `renderTypeBadge` for `m365_analyzer` with a distinct color (e.g., teal/cyan with `Activity` icon) to differentiate from M365 Compliance.

### 4. Update filter dropdowns (both tabs)

Add `<SelectItem value="m365_analyzer">M365 Analyzer</SelectItem>` to the type filter in both the Schedules and Executions tabs.

### 5. Fix task type mapping

Update `TASK_TYPE_TO_TARGET` so `m365_analyzer` maps to `'m365_analyzer'` (not `'m365_compliance'`).

### 6. Fix `latestTasks` query

Add `'m365_tenant'` to the `.in('target_type', [...])` filter so M365 Analyzer execution statuses appear correctly in the Schedules tab.

All changes are in a single file: `src/pages/admin/SchedulesPage.tsx`.

