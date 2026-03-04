

## Fix `user.group` and `user.adgrp` Formatters

### Problems

1. **`user.group`** (print 1): Content is `guest:35[user-id[fernanda.elisa@...]name[Fernanda]company[Taschibra]...]` — nested bracket format. But `parseUserFormat` tries to split by `, ` which doesn't match, so it dumps everything as a raw block.

2. **`user.adgrp`** (print 2): Content is `server-name[ad-advanced]` — standard `field[value]` format. But it's routed to `parseUserFormat` which doesn't handle brackets properly, showing `server-name[ad-advanced` with a lost bracket.

### Solution

**File**: `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **Refine `user.group` handling**: When content matches `identifier:N[nested...]`, extract the identifier, then parse the bracket content using the existing depth-counting bracket parser (`parseFieldBracketFormat` or `parseVipFormat` logic). Each inner `field[value]` becomes a row: `user-id: fernanda.elisa@...`, `name: Fernanda`, etc.

2. **Route `user.adgrp`** to `parseFieldBracketFormat` instead of `parseUserFormat` — it uses standard `field[value]` format.

3. **Update dispatcher** (line ~229):
   - Add `user.adgrp` check → route to `parseFieldBracketFormat`
   - Keep `user.group` in `parseUserFormat` but rewrite that function to detect bracket-nested format (`identifier:N[...]`) and parse with depth counting
   - Other `user.*` paths keep current comma-separated logic as fallback

4. **Rewrite `parseUserFormat`**:
   - First check if format is `word:N[field[val]field[val]...]` — if so, extract identifier, then use bracket tokenizer on inner content
   - Otherwise fall back to current comma/colon split logic

