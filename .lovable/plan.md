

# Fix: "Failed to send a request to the Edge Function" for trigger-external-domain-analysis

## Diagnosis

The edge function `trigger-external-domain-analysis` shows repeated "booted" logs but zero request processing logs. This means the function deployment is broken after our recent edit (removing the WHOIS call). The function needs a forced redeploy.

Additionally, `trigger-external-domain-analysis` is **missing from `supabase/config.toml`** — it should have `verify_jwt = false` since it handles auth internally (like all other functions in this project).

## Fix

1. **Add `trigger-external-domain-analysis` to `config.toml`** with `verify_jwt = false`
2. **Force redeploy** the function by touching the file (add a timestamp comment)

### Files to change

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.trigger-external-domain-analysis]` with `verify_jwt = false` |
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Add deploy timestamp comment to force redeploy |

