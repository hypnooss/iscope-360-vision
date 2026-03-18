

## Add expandable sync history timeline to CVE Sources section on Schedules page

### Problem
The "Sincronização de CVEs" table on `/schedules` is a flat, non-expandable table. It lacks the chevron expand button and the `SyncTimeline` component that already exists and works correctly on the dedicated `/cve-sources` page.

### Solution
Add expand/collapse state and the sync history timeline to the `CVESourcesSection` component in `src/pages/admin/SchedulesPage.tsx`, reusing the same lazy-loading pattern with `useCVESyncHistory`.

### Changes (single file: `src/pages/admin/SchedulesPage.tsx`)

1. **Import `useCVESyncHistory` and `CVESyncHistoryRow`** from `@/hooks/useCVECache` (currently only imports `useCVESources`).

2. **Add state and query to `CVESourcesSection`**:
   - `expandedIds` state (`Set<string>`)
   - `expandedSourceIds` memo (array from set)
   - `useCVESyncHistory(expandedSourceIds)` query
   - `toggleExpand` handler

3. **Add expand column** to the table header (empty `<TableHead className="w-10" />`).

4. **Wrap each source row in `<Fragment>`**, add chevron cell, make row clickable with `onClick={toggleExpand}`, and render a `CVESyncTimeline` expanded row below when open.

5. **Add inline `CVESyncTimeline` component** (or reuse constants already defined in the file for CVE status colors). This component will have the same 24h/48h/7d filter bar + status heatmap bar + counters, matching the pattern from `CVESourcesPage.tsx`.

