

## Fix Orphan Tasks and Timeout Issues

Three coordinated changes across the edge functions and the Python agent to address the two problems.

---

### Problem 1: Agent Offline — Skip tasks for offline agents

**Where**: `run-scheduled-analyses` edge function + each `trigger-*` edge function

**Approach**: Before creating a task, check if the agent's `last_seen` is within the last 5 minutes. If offline, skip the task and log it.

**Changes**:

1. **`supabase/functions/run-scheduled-analyses/index.ts`** — Add a pre-check function `isAgentOnline` that queries `agents.last_seen` for the asset's `agent_id`. Before calling each trigger function, resolve the agent and skip if offline.

   - For **firewall schedules**: join `firewalls.agent_id` → check `agents.last_seen`
   - For **domain schedules**: join `external_domains.agent_id` → check `agents.last_seen`
   - For **M365 schedules**: join `m365_tenant_agents` → check `agents.last_seen`
   - For **analyzer schedules**: same as firewall
   - Still update `next_run_at` even when skipped (so it doesn't re-trigger every minute)
   - Log: `[run-scheduled-analyses] Skipping firewall X: agent Y offline (last_seen: Z)`

2. **Each `trigger-*` function** (`trigger-firewall-analysis`, `trigger-firewall-analyzer`, `trigger-external-domain-analysis`, `trigger-m365-analyzer`): Add agent online check. If `last_seen` > 5min ago, return error response `{ success: false, error: 'Agent offline', code: 'AGENT_OFFLINE' }`. This prevents manual triggers on offline agents too.

---

### Problem 2a: Agent fetches too many tasks — Limit to MAX_PARALLEL_TASKS

**Where**: `rpc_get_agent_tasks` SQL function + `agent-tasks` edge function

The agent has `MAX_PARALLEL_TASKS = 4` but the RPC fetches up to `p_limit = 10`. The agent pulls 10 tasks, marks all 10 as `running`, but can only process 4 at a time. The remaining 6 sit in "running" state accumulating time toward timeout.

**Fix**: 
- **`supabase/functions/agent-tasks/index.ts`** line 260: Change `p_limit: 10` → `p_limit: 4`
- This is the simplest fix. The agent will only receive 4 tasks per poll cycle, matching its parallel capacity.

---

### Problem 2b: Staggered scheduling — Distribute tasks across the hour

**Where**: `supabase/functions/run-scheduled-analyses/index.ts`

Currently all schedules fire at `:00`. Add a deterministic offset per schedule to spread load.

**Approach**: Use a hash of the schedule ID to generate a 0-29 minute offset. Apply this offset to `calculateNextRunAt`.

```typescript
function getStaggerOffsetMinutes(scheduleId: string): number {
  // Simple hash: sum char codes, mod 30 → 0-29 minute offset
  let hash = 0;
  for (let i = 0; i < scheduleId.length; i++) {
    hash = ((hash << 5) - hash) + scheduleId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 30;
}
```

Then in `calculateNextRunAt`, add the offset minutes to the computed time. This ensures each schedule consistently fires at its own unique offset (e.g., firewall A at :03, firewall B at :17), spreading load across the hour.

---

### Problem 2c: Timeout too short + wrong running state

**Where**: `rpc_get_agent_tasks` SQL function (migration)

Current RPC line 144: `timeout_at = NOW() + INTERVAL '15 minutes'`

**Fix**: Change to `timeout_at = NOW() + INTERVAL '30 minutes'`

The "running" status is set at fetch time (in the RPC), not when execution actually starts. Since the agent processes tasks in a thread pool of 4, some tasks may wait in the internal queue before starting. Increasing timeout to 30 min gives adequate buffer.

A proper fix (agent reports `running` only when thread starts) would require Python agent changes and a new API endpoint. The 30-min timeout is the pragmatic fix for now.

---

### Summary of files changed

| File | Change |
|---|---|
| `supabase/functions/run-scheduled-analyses/index.ts` | Agent offline check + stagger offset |
| `supabase/functions/trigger-firewall-analysis/index.ts` | Agent offline check |
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Agent offline check |
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Agent offline check |
| `supabase/functions/trigger-m365-analyzer/index.ts` | Agent offline check |
| `supabase/functions/agent-tasks/index.ts` | `p_limit: 10` → `p_limit: 4` |
| New migration SQL | `rpc_get_agent_tasks` with 30-min timeout |

