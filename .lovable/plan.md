

## Fix `firewall.policy` Edit Visualization

### Problem

When `firewall.policy` has an Edit action, the `cfgattr` often contains a numbered member list like `005]: .net infosetetelecom.com.br Site Prefeitura SJB ...` (destination addresses). The current code tries `parseFieldBracketFormat` which fails to parse the `005]` prefix properly, resulting in a messy wall of gray chips with no context.

### Solution

Add a specific handler for `firewall.policy` before the generic `firewall.*` catch-all in `formatByPath`:

1. **If cfgattr contains `field[old->new]` diffs** (e.g., `action[deny->accept]`), use the existing `parseFieldBracketFormat` — these are proper field changes.

2. **If cfgattr is a numbered member list** (matches `\d+\]:` pattern), strip the prefix and display as a labeled member list — reuse the `parseAddrgrpFormat` logic with a contextual label like "Objetos da Política".

3. **Apply `fixTruncatedName`** to each token (handles `.net` fragments that are truncated source data).

### Changes to `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

**New function `parsePolicyMemberList`** — strips numbered prefix, labels tokens as "Objetos da Política", applies truncation fix.

**Updated `formatByPath`** — Add `firewall.policy` case before the generic `firewall.*` block:
```
if (path === 'firewall.policy') {
  // Try field[old->new] first
  if (/\w+\[.*->.*\]/.test(cfgattr)) { ... parseFieldBracketFormat }
  // Numbered member list fallback
  if (/\d+\]\s*:/.test(cfgattr)) { ... parsePolicyMemberList }
}
```

This gives `firewall.policy` the same clean treatment as `firewall.addrgrp` and `user.group`.

