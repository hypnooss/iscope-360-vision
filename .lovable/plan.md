

# Fix: RPC `rpc_get_agent_tasks` - Type Cast Error

## Problem

The RPC is failing with:
```
operator does not exist: blueprint_executor_type = text
```

The `CASE WHEN` expression in the updated RPC returns a plain `text` value (`'hybrid'` / `'agent'`), but the column `db.executor_type` is of type `blueprint_executor_type` (an enum). PostgreSQL cannot compare them without an explicit cast.

This blocks **ALL** agent task fetching, not just analyzer tasks.

## Fix

A single SQL migration to replace the RPC function, adding `::blueprint_executor_type` cast to the CASE expression result:

```sql
AND db.executor_type = CASE 
  WHEN t.task_type = 'firewall_analyzer' THEN 'hybrid'::blueprint_executor_type
  ELSE 'agent'::blueprint_executor_type
END
```

This cast needs to be applied in the firewall section of the RPC query.

## Files Changed

| Resource | Change |
|----------|--------|
| SQL migration | `CREATE OR REPLACE FUNCTION rpc_get_agent_tasks` with explicit enum casts |

No frontend or edge function changes needed.

