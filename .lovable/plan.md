

## Changes

### 1. Remove "Avisos" MiniStat card
Remove line 369 (`{warnCount > 0 && <MiniStat ...>}`). Keep only Total, Aprovadas, and Falhas. The `warnCount` variable can also be removed.

### 2. Sort categories by template `display_order` instead of severity
Replace the current severity-based sorting with the `display_order` from `rule_categories` table (the template visualization tab).

- Import and use `useCategoryConfig` hook with the M365 device type ID (`5d1a7095-2d7b-4541-873d-4b03c3d6122f`)
- Replace `sortedCategories` logic: look up each category's `display_order` from the fetched config, sort ascending by that order, fallback to 999 for unknown categories

```typescript
const { data: categoryConfigs } = useCategoryConfig('5d1a7095-2d7b-4541-873d-4b03c3d6122f');

const sortedCategories = (Object.keys(groupedItems) as M365RiskCategory[]).sort((a, b) => {
  const aOrder = categoryConfigs?.find(c => c.name === a)?.display_order ?? 999;
  const bOrder = categoryConfigs?.find(c => c.name === b)?.display_order ?? 999;
  return aOrder - bOrder;
});
```

### Files changed
| File | Change |
|------|--------|
| `M365PosturePage.tsx` | Remove Avisos MiniStat; sort categories by template `display_order` |

