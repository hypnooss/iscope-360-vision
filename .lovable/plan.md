

## Adjust spacing in Security Insight Cards to match Asset Health Grid

### Differences found

| Property | SecurityInsightCard | AssetHealthGrid |
|----------|-------------------|-----------------|
| Grid gap | `gap-3` | `gap-x-6 gap-y-4` |
| Card padding | `p-4` | `pl-5 pr-3 py-3` |

### Change

**`src/components/m365/shared/SecurityInsightCard.tsx`**:
- Line 121: Change grid from `gap-3` to `gap-x-6 gap-y-4`
- Line 143: Change card inner padding from `p-4` to `pl-5 pr-3 py-3`

