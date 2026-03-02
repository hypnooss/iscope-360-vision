

## M365 Compliance Module - Audit Results

After analyzing the blueprints, edge functions, recently collected data, and frontend rendering, I identified the following issues organized by priority.

---

### Bug 1: "Aprovadas" count is wrong (Critical - UI)

**Location:** `M365PosturePage.tsx` line 349

The current formula:
```
total - critical - high - medium - low
```
Results in `71 - 8 - 7 - 6 - 1 = 49`, but only **33 items actually passed** (27 Graph + 6 Agent). The remaining 16 are `not_found` (9), `warn` (6), and `unknown` (1) — all incorrectly counted as "Aprovadas".

**Fix:** Count actual pass items from the unified list instead of subtracting fails from total.

---

### Bug 2: Score doesn't include Agent PowerShell penalties (Critical - Backend)

**Location:** `trigger-m365-posture-analysis` and `agent-task-result`

The score saved to `m365_posture_history` comes exclusively from the Graph API analysis (line 1845 of `m365-security-posture`). When the Agent data merges in `agent-task-result`, the summary is recalculated but the **score is not recalculated** to include agent-sourced failures (e.g., EXO-001 critical, EXO-022 critical). This means 2 critical agent failures don't reduce the score at all.

**Fix:** In the `agent-task-result` merge logic, recalculate the overall score using the same penalty formula, applying it to both Graph and Agent insights combined.

---

### Bug 3: `affectedCount` is decimal for DEF-004 (Medium - Backend)

**Data:** DEF-004 (Secure Score) stores `affectedCount: 71.5`, which is the raw Microsoft Secure Score value. This should be the **current score integer**, not a float. The `check_secure_score` evaluator (line 825) sets `affectedCount = current` which is a float from the API.

**Fix:** Round `affectedCount` to integer in the `check_secure_score` evaluator: `affectedCount = Math.round(current)`.

---

### Bug 4: Category display order is random (Low - UI)

**Location:** `M365PosturePage.tsx` line 374

Categories are rendered in `Object.keys(groupedItems)` order, which is insertion order of the JS object — essentially random. Categories with critical failures can appear after clean categories.

**Fix:** Sort categories: first by number of critical items descending, then by fail count, then alphabetically. This ensures the most urgent categories appear at the top.

---

### Bug 5: "Falhas" MiniStat doesn't include `warn` items (Low - UI)

**Location:** `M365PosturePage.tsx` line 350

The "Falhas" count uses `critical + high + medium + low` from the summary, which only counts `status=fail` items. There are 6 `warn` agent items that are not reflected in either "Aprovadas" or "Falhas". These warnings should either be counted as falhas or shown as a separate MiniStat.

**Fix:** Add `warn` counts to the "Falhas" total, or add a third "Avisos" MiniStat.

---

### Summary of Changes

| File | Change |
|------|--------|
| `M365PosturePage.tsx` | Fix Aprovadas/Falhas counts; sort categories by severity |
| `m365-security-posture/index.ts` | Round affectedCount in `check_secure_score` |
| `agent-task-result/index.ts` | Recalculate score when merging agent data |
| `trigger-m365-posture-analysis/index.ts` | No changes needed |

