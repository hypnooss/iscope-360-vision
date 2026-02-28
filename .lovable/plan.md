

## Fix net-004 evidence format

Current evidence templates:
- `evidence_label`: `Regra #{policyid}: {name}`
- `evidence_value`: `{srcintf} → {dstintf} · action: {action}`

Change to:
- `evidence_label`: `Regra #{policyid}`
- `evidence_value`: `{name}`

Also fix the `interpolate` helper in `agent-task-result/index.ts` (line 874-876) to handle array/object values (the `[object Object]` fix from the previous plan).

### Files

| File | Change |
|---|---|
| `supabase/functions/agent-task-result/index.ts` | Fix `interpolate` to handle arrays of objects with `name` field |
| New migration | Update net-004 `evidence_label` and `evidence_value` |

