

# Fix: Intermittent "Failed to send a request to the Edge Function"

## Diagnosis

The logs confirm the function **works for some domains** (altamogiana.com.br succeeded at 22:43) but shows repeated `booted` entries without any processing for subsequent calls. The `FunctionsFetchError` ("Failed to send a request") means the HTTP request itself fails at network level before reaching the handler.

This pattern — function boots but request never reaches handler — is typically caused by **flaky `esm.sh` imports**. The current import `https://esm.sh/@supabase/supabase-js@2` is a floating version redirect that can fail intermittently on cold starts when esm.sh CDN is slow or returns stale redirects.

## Fix

**Pin the `esm.sh` import to a specific version** to eliminate CDN redirect flakiness, and force a clean redeploy:

| File | Change |
|------|--------|
| `supabase/functions/trigger-external-domain-analysis/index.ts` | Change `https://esm.sh/@supabase/supabase-js@2` → `https://esm.sh/@supabase/supabase-js@2.49.1` (pinned version). Update deploy timestamp. |

This is a one-line import change. Pinning the version eliminates the 302 redirect that esm.sh does for `@2` → `@2.x.y`, which is the most common source of intermittent boot failures in Deno Edge Functions.

