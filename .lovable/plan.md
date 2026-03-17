

## Add Sync History Timeline to CVE Sources Page

### Problem
The CVE Sources page currently shows only the **last** sync status per source. There is no history table tracking past sync runs, so we cannot display a timeline like the Schedules page.

### Solution

Three changes:

---

### 1. Create `cve_sync_history` table (migration)

```sql
CREATE TABLE public.cve_sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.cve_sources(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,          -- 'success', 'error', 'partial'
  cve_count integer DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cve_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync history"
  ON public.cve_sync_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert sync history"
  ON public.cve_sync_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_cve_sync_history_source_id ON public.cve_sync_history(source_id);
CREATE INDEX idx_cve_sync_history_created_at ON public.cve_sync_history(created_at DESC);
```

---

### 2. Update `refresh-cve-cache` edge function

At the end of each source sync (success, partial, or error), insert a row into `cve_sync_history`:

- On success/partial: insert with `status='success'` or `status='partial'`, `cve_count`, `duration_ms`
- On error: insert with `status='error'`, `error_message`

Record `started_at` before sync begins, compute `duration_ms` at the end.

---

### 3. Redesign CVE Sources page to table + expandable timeline

Replace the current card-based grouped layout with a **flat table** matching the Schedules page pattern:

| (expand) | Fonte | Módulo | Status | Último Sync | Próxima Execução | CVEs |
|-----------|-------|--------|--------|-------------|------------------|------|

- Clicking a row expands it to show the `ScheduleTimeline`-style component (same 24h/48h/7d filter + status bar)
- History data fetched lazily (only when expanded) from `cve_sync_history` where `source_id = X` and `created_at >= 7 days ago`
- Keep the Switch and Sync button in the row
- Map sync history statuses to bar colors: `success` → green, `error` → red, `partial` → yellow

### Files to change
- New migration SQL file
- `supabase/functions/refresh-cve-cache/index.ts` — add history inserts
- `src/pages/admin/CVESourcesPage.tsx` — redesign to table + timeline
- `src/hooks/useCVECache.ts` — add `useCVESyncHistory` hook

