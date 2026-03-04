

## Root Cause: `cleanup_stuck_tasks` Is Never Called

The DB function `cleanup_stuck_tasks()` exists and correctly marks timed-out tasks, but **nothing invokes it**. There's no `pg_cron` job, no edge function call — it's dead code. That's why the 4 Firewall Analyzer tasks in your screenshot have been "Executando" for 42+ minutes despite the 30-minute timeout.

## Fix

### 1. Call `cleanup_stuck_tasks` at the start of `run-scheduled-analyses`

Since `run-scheduled-analyses` already runs on a cron (every minute via Supabase cron), add a single RPC call at the top:

```typescript
// Right after creating supabase client, before fetching schedules:
await supabase.rpc('cleanup_stuck_tasks');
```

This ensures every minute, stuck tasks get cleaned up before new ones are dispatched.

### 2. Also call it from `agent-tasks` (belt-and-suspenders)

When an agent polls for tasks, also run cleanup so the agent doesn't see stale tasks:

```typescript
// At the start of the agent-tasks handler, after auth:
await supabase.rpc('cleanup_stuck_tasks');
```

### 3. Update `cleanup_stuck_tasks` to use 30-min timeout (align with RPC change)

The current function still references `'15 minutes'` in its error message and fallback logic. Update the migration:

```sql
CREATE OR REPLACE FUNCTION public.cleanup_stuck_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE agent_tasks
  SET 
    status = 'timeout',
    error_message = 'Task excedeu tempo máximo de execução (30 min)',
    completed_at = NOW()
  WHERE status = 'running'
    AND (
      timeout_at IS NOT NULL AND timeout_at < NOW()
      OR
      timeout_at IS NULL AND started_at < NOW() - INTERVAL '30 minutes'
    );
END;
$$;
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/run-scheduled-analyses/index.ts` | Add `supabase.rpc('cleanup_stuck_tasks')` at start |
| `supabase/functions/agent-tasks/index.ts` | Add `supabase.rpc('cleanup_stuck_tasks')` after auth |
| New migration SQL | Update `cleanup_stuck_tasks` to 30-min message/fallback |

