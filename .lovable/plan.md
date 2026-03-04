

## Fix `user.group` Visualization: Diff-Based Coloring + Truncation Handling

### Problem Analysis

After querying the actual database data, I found:

1. **"Eating letters"** — Not a code bug. The FortiOS source data is truncated at a fixed width, so some entries start mid-name (e.g., `[001]: eira paulo.silva...` where `eira` is the tail of `vieira` or `moreira`). However, we CAN improve by detecting names that start with `.` or lowercase fragments and flagging them as potentially truncated.

2. **No colors visible** — All entries in the screenshot are `Edit` actions, which by design render neutral gray chips. The `Add`/`Delete` coloring works but there are no Add/Delete entries for this group. To make colors meaningful for Edit actions, we need to **compare consecutive entries** for the same group and compute the member diff.

### Solution: Compare Consecutive `user.group` Edits

When expanding a `user.group` Edit row, find the **previous entry** for the same `cfgobj` (group name) and compute which members were added (green), removed (red), or unchanged (neutral).

### Changes to `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

**1. Update `parseUserGroupFormat` to accept an optional previous member list:**

```typescript
function parseUserGroupFormat(raw: string, action: string, previousMembers?: string[]): ParsedChange[] {
  const cleaned = raw.replace(/^\[?\d+\]\s*:\s*/, '').trim();
  const currentMembers = cleaned.split(/\s+/).filter(Boolean);
  
  if (previousMembers && action.toLowerCase() === 'edit') {
    const prevSet = new Set(previousMembers);
    const currSet = new Set(currentMembers);
    const added = currentMembers.filter(m => !prevSet.has(m));
    const removed = previousMembers.filter(m => !currSet.has(m));
    const unchanged = currentMembers.filter(m => prevSet.has(m));
    
    const results: ParsedChange[] = [];
    if (added.length > 0) results.push({ field: 'Membros adicionados', raw: added.join(' '), colorHint: 'Add' });
    if (removed.length > 0) results.push({ field: 'Membros removidos', raw: removed.join(' '), colorHint: 'Delete' });
    if (unchanged.length > 0) results.push({ field: 'Membros mantidos', raw: unchanged.join(' '), colorHint: 'neutral' });
    return results.length > 0 ? results : [{ field: 'Membros (lista atual)', raw: currentMembers.join(' ') }];
  }
  // ... existing label logic for Add/Delete actions
}
```

**2. When expanding a `user.group` row, query the previous entry:**

In the expand handler or in `formatByPath`, find the previous entry for the same `cfgobj` from `rows` (already loaded) or with a quick query. Since consecutive entries are typically on the same page, we can scan `rows` for the next older entry with the same `cfgpath` + `cfgobj`.

**3. Handle `guest:N[...]` and `match:N[...]` sub-formats:**

These should NOT go through member list parsing. Add a check: if cfgattr starts with `guest:` or `match:`, route to `parseFieldBracketFormat` or `parseRouterAccessListFormat` (nested bracket flattener) instead.

**4. Handle truncated names gracefully:**

Names starting with `.` (like `.silva`, `.ribeiro`) are clearly truncated. Prepend a `…` indicator: `…silva` to signal incompleteness.

### Summary

| Change | Detail |
|---|---|
| `parseUserGroupFormat` | Accept previous members, compute add/remove/unchanged diff with colored groups |
| `formatByPath` user.group branch | Detect `guest:`/`match:` sub-formats, route differently |
| Expand handler | Find previous same-group entry in loaded rows for diff comparison |
| Truncation indicator | Prepend `…` to names starting with `.` |

