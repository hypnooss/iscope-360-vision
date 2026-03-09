

# Fix: WHOIS data not being saved + parsing issues

## Root Causes

**1. Edge function `agent-task-result` not redeployed**
The domain_whois extraction code (lines 4847-4874) exists in the file but was never deployed. The edge function logs confirm: 8 steps reconstructed successfully for iemadeira.com.br, but zero "WHOIS" or "domain_whois" log entries. The data IS in `task_step_results` with `status=success` — it's just never processed.

**2. Duplicate WHOIS lookup from `trigger-external-domain-analysis`**
The trigger function still calls `domain-whois-lookup` edge function (line 339-351), which sets `whois_checked_at` but finds no data (403 from cloud). This creates a false "checked" state with NULL registrar/expires, and when the agent data arrives later, the edge function code to process it isn't even deployed.

**3. registro.br RDAP parsing: registrar field is wrong**
For `.br` domains, registro.br's RDAP response has no entity with `role: "registrar"`. The current parser falls back to the first entity with a vCard name, which is the **registrant** ("Interligação Eletrica do Madeira S/A"). The actual registrar for all `.br` domains is "Registro.br" (NIC.br). Similarly, the response has no `expiration` event at the entity level — it's at the **top-level** `events` array, which the parser already handles correctly.

**4. precisio.io: RDAP 404 + TCP fallback parsing**
`rdap.org` returned 404 for `precisio.io`. The TCP fallback connected to `whois.nic.io` and followed referral to `whois.godaddy.com`. This likely worked in the latest run (after the fix was deployed on the agent) but earlier runs show `status: failed` because the executor didn't exist yet.

## Implementation

### 1. Force redeploy `agent-task-result` edge function
Add a comment/timestamp to trigger Lovable's auto-deployment, ensuring the domain_whois extraction code goes live.

### 2. Remove duplicate WHOIS call from `trigger-external-domain-analysis`
Remove lines 333-354 that call `domain-whois-lookup` edge function. The Agent is now the sole source of WHOIS data. This prevents the false `whois_checked_at` being set with no data.

### 3. Fix `.br` registrar parsing in `domain_whois.py`
In `_parse_rdap`:
- If no entity has `role: "registrar"` AND the domain ends with `.br`, set `registrar = "Registro.br (NIC.br)"`
- Also search for events in nested entities when top-level events are missing (registro.br sometimes puts registration/expiration dates at the entity level)

### 4. Improve `.io` RDAP resolution
Add `.io` RDAP endpoint: `https://rdap.identitydigital.services/rdap/v1/domain/{}` (the actual .io RDAP server, instead of relying on rdap.org which returns 404)

### Files to change

| File | Change |
|------|--------|
| `supabase/functions/agent-task-result/index.ts` | Force redeploy (touch) |
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Remove `domain-whois-lookup` call |
| `python-agent/agent/executors/domain_whois.py` | Fix `.br` registrar, add `.io` RDAP endpoint |

