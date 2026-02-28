

## Plan: Remove title from M365 tenant add page

### `src/pages/environment/AddM365TenantPage.tsx`

1. **Remove the title block** (lines 577-590) — the `div` with back button, Cloud icon, "Conectar Microsoft 365" heading and subtitle.

2. **Add spacing before StepIndicator** — wrap StepIndicator in `<div className="pt-10">` to match the firewall page pattern.

3. **Cleanup unused imports** — remove `ArrowLeft` and `Cloud` from lucide-react imports (if not used elsewhere in the file).

