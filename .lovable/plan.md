

## Problem

The `firewall.policy` Edit visualization shows "Objetos da Política" as a flat list of neutral chips, but gives **zero context** about what changed — the user can't tell if objects were added, removed, or just listed. Same problem we already solved for `user.group`.

## Solution

Apply the same **diff-based comparison** approach used for `user.group`: when a `firewall.policy` Edit has a numbered member list, find the **previous entry** for the same policy (`cfgobj`) in the loaded rows, compare member lists, and display colored chips:

- **Green** — objects added to the policy
- **Red + strikethrough** — objects removed
- **Neutral** — unchanged objects

### Changes to `src/pages/firewall/AnalyzerConfigChangesPage.tsx`

1. **Update `parsePolicyMemberList`** to accept optional `previousMembers` and compute the diff (same pattern as `parseUserGroupFormat`):
   - Added → `{ field: 'Objetos adicionados', colorHint: 'Add' }`
   - Removed → `{ field: 'Objetos removidos', colorHint: 'Delete' }`
   - Unchanged → `{ field: 'Objetos mantidos', colorHint: 'neutral' }`

2. **Extract policy member tokens** into a helper `extractPolicyMembers(raw)` (strips numbered prefixes, splits, applies truncation fix).

3. **Update the `firewall.policy` branch in `formatByPath`** to look back for the previous entry of the same `cfgobj` (same logic already used for `user.group`) and pass previous members to `parsePolicyMemberList`.

4. **When no previous entry exists** (first occurrence or Add/Delete action), fall back to current behavior with "Objetos da Política" label and action-colored chips.

