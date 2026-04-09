

## Problem

The pipeline's `compliance` step is stuck at `running` because of a mismatch between how the pipeline creates an analysis record and how the agent writes results:

1. **Pipeline** creates an analysis record with `source: 'api_pipeline'`, `status: 'pending'` (ID: `ec52d157...`)
2. **Agent** completes the task but creates a **new** analysis record with `source: 'agent'`, `status: 'completed'` (ID: `e0679f72...`)
3. **Polling** checks the original record (`ec52d157`) by ID — it stays `pending` forever because the agent never touches it

The agent's `agent-task-result` function (line 5280) always **inserts** a new record with `source: 'agent'` instead of updating the existing pipeline record.

## Fix

Two changes are needed:

### 1. Update `agent-task-result/index.ts` — Use existing analysis record when available

When the agent task's payload contains an `analysis_id` (set by the pipeline at line 385), the agent-task-result handler should **update** that existing record instead of inserting a new one.

**At line ~5277** in `agent-task-result/index.ts`:
- Check if `task.payload?.analysis_id` exists
- If yes: UPDATE the existing record (`status: 'completed'`, score, report_data, etc.)
- If no: INSERT a new record as before (backward-compatible with non-pipeline triggers)

### 2. Harden `pollCompliance` fallback in `process-api-jobs/index.ts`

Update the fallback branch (lines 202-219) to also check for any completed analysis with `source: 'agent'` created **after** the step started — this handles cases where the agent doesn't update the pipeline record (edge case/race condition).

**At line ~203**:
- Query for latest completed analysis for the domain created after `step.started_at`
- Also update the original pipeline analysis record to `completed` (cleanup)

### 3. Fix stale data — Update the stuck job

After deploying, manually update the stuck analysis record `ec52d157` to `completed` using the data from the agent's completed record `e0679f72`, so the current pipeline can progress.

---

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/agent-task-result/index.ts` | Check `payload.analysis_id` and UPDATE instead of INSERT when present |
| `supabase/functions/process-api-jobs/index.ts` | Improve `pollCompliance` fallback to find agent-created completed analyses |

