

## Problem

All three compliance pages (M365, Firewall, Domain) share the same bug: **the progress bar only disappears if the user triggered the analysis in the current session**. If the user navigates away and returns, or if the page was already open when the task finished, the progress bar gets stuck because:

1. **M365 Posture**: Detects active analysis on mount (queries `m365_posture_history` for `pending`/`partial` status), but the polling only checks `m365_posture_history.status` — if the `agent-task-result` edge function already updated it to `completed`, the mount query returns nothing, the `activeAnalysisId` is never set, and polling never starts. **However**, if the record is still `partial` at mount time, it restores correctly. The real issue is the **missing frontend timeout** (memory says 10 min, but code has none) and the fact that `partial` + `agent_status=completed` may not be detected fast enough.

2. **Firewall & Domain Compliance**: These pages have **no mount-time detection at all**. The `activeTaskId` is only set when the user clicks "Refresh" in that session. If the user triggers analysis, navigates away, and returns — the progress bar won't show, but conversely, if they stay on the page and the network hiccups, the polling may miss the terminal status.

**Root cause for the screenshot**: The M365 page restored an active analysis on mount (`partial` status), started polling, but the polling check at line 153 doesn't match the actual terminal state. The `agent_status` field might not be updating, or the record is stuck in `partial` without the agent_status being set to a terminal value.

## Plan

### 1. M365PosturePage — Add frontend safety timeout + robust termination

- Add a **10-minute frontend timeout**: if `elapsed > 600`, force-clear the progress bar and show a warning toast
- In the polling effect, also handle the case where the `m365_posture_history` record simply no longer exists or has been updated outside the polling window

### 2. Firewall & Domain Compliance Pages — Add mount-time active task detection

For both `FirewallCompliancePage` and `ExternalDomainCompliancePage`:

- Add a query on mount that checks `agent_tasks` for any `pending`/`running` task matching the selected firewall/domain, similar to M365's mount detection
- If found, restore `activeTaskId` and `taskStartedAt` so polling kicks in automatically
- Add **10-minute frontend timeout** as safety net

### 3. All three pages — Ensure polling stops on terminal states

The existing polling logic already handles `completed`/`failed`/`timeout` correctly for Firewall and Domain. For M365, the logic at line 153 is correct but may need the frontend timeout as backup.

### Files to modify

- `src/pages/m365/M365PosturePage.tsx` — add 10-min timeout effect
- `src/pages/firewall/FirewallCompliancePage.tsx` — add mount-time task detection + 10-min timeout
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx` — add mount-time task detection + 10-min timeout

