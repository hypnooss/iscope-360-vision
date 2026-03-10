

## Fix: "Cannot access 'upn' before initialization"

### Cause
In `supabase/functions/exchange-dashboard/index.ts`, line 175 references `upn` but it's declared on line 186 (after the quota check block). JavaScript `const` declarations are not hoisted, causing the runtime error.

### Fix
Move `const upn = row['User Principal Name'] || row['Display Name'] || '';` (line 186) to the top of the `forEach` callback, before the quota check on line 172. Same issue exists in the JSON branch (~line 219) where `upnJ` is used before declaration — fix that too.

Single file change: `supabase/functions/exchange-dashboard/index.ts`, then redeploy.

