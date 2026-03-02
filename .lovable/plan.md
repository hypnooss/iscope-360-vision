

## Bug: Domain name displayed twice in selector

**Problem:** The domain selector at line 544 renders `{d.name} ({d.domain})`. When the `name` and `domain` fields contain the same value (e.g., both are `taschibra.com.br`), it shows `taschibra.com.br (taschibra.com.br)` — appearing duplicated.

**Fix:** Show `{d.domain}` only when it differs from `{d.name}`. Otherwise show just `{d.name}`.

### Change in `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

**Line 544** — Change the SelectItem content:
```tsx
// Before
<SelectItem key={d.id} value={d.id}>{d.name} ({d.domain})</SelectItem>

// After
<SelectItem key={d.id} value={d.id}>
  {d.name}{d.domain && d.domain !== d.name ? ` (${d.domain})` : ''}
</SelectItem>
```

Single-line change, one file only.

