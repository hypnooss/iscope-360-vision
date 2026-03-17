

## Dedicated history queries for M365 Compliance and M365 Analyzer

### Problem

M365 Compliance and M365 Analyzer timelines use the generic `taskHistory` query (global, 5000-row limit). High-frequency tasks saturate this query, so the timeline bar and counters don't update when switching between 24h/48h/7d filters — same issue we fixed for Firewall Analyzer.

### Solution

Apply the same lazy-loading pattern used for `analyzerHistory`: create dedicated queries that only fire when the corresponding schedule is expanded, filtering by specific `task_type` values.

### Changes (single file: `src/pages/admin/SchedulesPage.tsx`)

1. **Add `expandedM365ComplianceIds` and `expandedM365AnalyzerIds` memos** — filter `schedules` by `targetType` + `expandedIds`, same pattern as `expandedFirewallAnalyzerIds`.

2. **Add `m365ComplianceHistory` query** — query `agent_tasks` where `task_type IN ('m365_compliance', 'm365_powershell')` and `target_id IN expandedM365ComplianceIds`, with `gte(sevenDaysAgo)`, no fixed limit.

3. **Add `m365AnalyzerHistory` query** — query `agent_tasks` where `task_type = 'm365_analyzer'` and `target_id IN expandedM365AnalyzerIds`, with `gte(sevenDaysAgo)`, no fixed limit.

4. **Update timeline `tasks` prop** — add two new branches before the `else` fallback:
   - `schedule.targetType === 'm365_compliance'` → use `m365ComplianceHistory`
   - `schedule.targetType === 'm365_analyzer'` → use `m365AnalyzerHistory`

