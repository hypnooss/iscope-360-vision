

## Three Fixes

### 1. Alert redirect (SystemAlertBanner.tsx)

Line 180: `handleViewAnalysis` navigates to `/scope-firewall/firewalls/${firewallId}/analysis` (old route). Change to `/scope-firewall/compliance`.

### 2. Progress bar position (FirewallCompliancePage.tsx)

Lines 360-396: "Última coleta" block is rendered **before** the task progress bar. Swap the two blocks so progress bar appears first (matching Analyzer layout from screenshot 1).

### 3. Shadow Rules net-004 — root cause found

The rule uses `source_key: firewall_policy_stats` (monitor endpoint) which returns objects with `bytes`, `hit_count`, `policyid` — but **no `status` or `action` fields**. The `pre_filters` require `status === 'enable'` and `action not_in ['deny','block']`, which filter out **every single item** (none have those fields), resulting in 0 items → 0 violations → pass.

Raw data confirms policies 212, 113, 114 have `bytes: 0, hit_count: 0` — these are real shadow rules being missed.

**Fix**: Add `join_source` support to `filtered_count_check` in `agent-task-result/index.ts`. The rule will specify a secondary data source to merge fields from before filtering:

```json
{
  "type": "filtered_count_check",
  "source_key": "firewall_policy_stats",
  "join_source": { "key": "firewall_policy", "on": "policyid", "fields": ["status", "action", "name", "srcintf", "dstintf"] },
  "pre_filters": [...],
  "match_conditions": [...]
}
```

The engine will:
1. Load `firewall_policy_stats.results` as the primary array
2. Load `firewall_policy.results` and index by `policyid`
3. Merge matched fields into each stats item
4. Then apply pre_filters and match_conditions as normal

Update the `net-004` rule's `evaluation_logic` in a migration to include the `join_source`.

### Files changed

| File | Change |
|---|---|
| `src/components/alerts/SystemAlertBanner.tsx` | Fix route on line 180 |
| `src/pages/firewall/FirewallCompliancePage.tsx` | Swap progress bar above "Última coleta" |
| `supabase/functions/agent-task-result/index.ts` | Add `join_source` merging in `evaluateFilteredCountCheck` |
| New migration | Update net-004 `evaluation_logic` to include `join_source` |

