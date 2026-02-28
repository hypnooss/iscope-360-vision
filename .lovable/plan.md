

## Fix: Align Surface Analyzer tabs with Compliance standard

The `AssetDetailSheet.tsx` TabsTrigger classes differ from the `ComplianceDetailSheet.tsx` standard:

| Property | Compliance (correct) | Surface (current) |
|---|---|---|
| Font size | `text-xs` | `text-sm` |
| Shadow | _(none)_ | `data-[state=active]:shadow-none` |

### Change

**`src/components/surface/AssetDetailSheet.tsx`** (lines 320-335): Update all four `TabsTrigger` elements to match the Compliance pattern:
- Change `text-sm` → `text-xs`
- Remove `data-[state=active]:shadow-none`

