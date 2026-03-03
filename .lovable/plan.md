

## Fix: M365 schedule not displayed on Environment page

The schedule **is being saved** correctly to `m365_analyzer_schedules` (confirmed in the database). The problem is that `EnvironmentPage.tsx` does not query this table.

### What's missing

In `EnvironmentPage.tsx`:
1. **No query for `m365_analyzer_schedules`** — lines 93-94 only fetch `analysis_schedules` (firewalls) and `external_domain_schedules` (domains). There is no equivalent query for M365.
2. **No schedule mapping for M365 tenants** — the M365 tenant mapping (lines 147-159) does not set `scheduleFrequency`, `scheduleHour`, `scheduleDayOfWeek`, or `scheduleDayOfMonth`.

### Fix

1. Add a query for `m365_analyzer_schedules` selecting `tenant_record_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month` where `is_active = true`
2. Add it to the `Promise.all` call
3. Build a `m365ScheduleMap` keyed by `tenant_record_id`
4. In the M365 tenant mapping block, populate the 4 schedule fields from `m365ScheduleMap`

This is a single-file change (~10 lines added) in `src/pages/EnvironmentPage.tsx`.

