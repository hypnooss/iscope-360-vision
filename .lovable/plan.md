

## Fix `firewall.addrgrp` Formatter

### Problem

`firewall.addrgrp` is caught by the generic `firewall.*` branch (line 229) and sent to `parseFieldBracketFormat`, which expects `field[old->new]`. The actual content is a member list like `[001]: WT008064dc32d0 WT008064e27ea5 MAC_Susane_B2B...` — this format has no field names before brackets, so the parser produces broken output with orphan `001]:` fragments.

### Solution

**File**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **Add `firewall.addrgrp` exclusion before the generic `firewall.*` branch** in `formatByPath` (around line 228):
   - Route `firewall.addrgrp` and `firewall.addrgrp6` to a dedicated handler
   - The handler strips the `[NNN]:` prefix pattern, then tokenizes the remaining content as a member list
   - Render members as chips/tokens (reuse the existing `parseListFormat` logic but with cleanup for the `[NNN]:` prefix)

2. **Create `parseAddrgrpFormat(raw)`**:
   - Strip leading patterns like `[001]: ` or numbered prefixes
   - Split remaining content by whitespace into member names
   - Return as a single `ParsedChange` with `field: 'Membros'` and the token list in `raw` — the existing chip renderer will display them nicely

3. **Order matters**: Place the `addrgrp` check **before** the generic `firewall.*` check so it doesn't fall through.

