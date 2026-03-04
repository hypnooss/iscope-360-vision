

## Fix `user.group` Parser for Multi-Block Bracket Format

### Problem

`parseUserFormat` only handles the single-block pattern `identifier:N[field[val]...]` via regex. But `user.group` data often has **multiple concatenated top-level blocks**:

- `id[14]member[SRVW19DC01 SRVW19DC02]match:2[server-name[...]group-name[...]]match:1[...]`  
- `match:1[<Delete>server-name[SRVW19DC01]group-name[...]]match:2[...]`

The regex `^(\w+):(\d+)\[(.+)\]$` fails on these, so they fall through to the comma-split logic which produces garbage.

### Solution

**File**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx` — rewrite `parseUserFormat`

Replace the single nested-match regex with a **general depth-counting tokenizer** that works on any sequence of `token[value]` blocks at the top level:

1. Use a depth-counting loop over the entire string to split into top-level tokens at depth 0
2. Each token like `field[value]` or `identifier:N[nested...]` gets parsed:
   - If it's `word:N[inner...]` → push ID row, then recursively tokenize inner content for sub-fields
   - If it's `field[value]` with no nested brackets → push as simple field/value row
   - If it's `field[nested[...]]` → recursively tokenize inner content, prefix with field label
3. Handle `<Delete>` tags inside values (strip tag, mark appropriately)
4. Keep the existing comma-split fallback only if no brackets are found at all

This approach handles all three screenshot cases uniformly — single `guest:35[...]`, multi-block `id[14]member[...]match:N[...]`, and `match:N[<Delete>...]`.

