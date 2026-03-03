
## Fix: Map `fortigate_compliance` to "Firewall Compliance" label

**File**: `src/pages/firewall/TaskExecutionsPage.tsx`, line 104-113

**Change**: Add `fortigate_compliance` entry to `typeConfig` (same style as `fortigate_analysis`), and optionally keep `fortigate_analysis` as an alias:

```typescript
const typeConfig: Record<string, { label: string; color: string }> = {
  fortigate_compliance: {
    label: 'Firewall Compliance',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  },
  fortigate_analysis: {
    label: 'Firewall Compliance',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  },
  fortigate_analyzer: {
    label: 'Firewall Analyzer',
    color: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
  },
};
```

Also update the detail sheet (line ~627) where `selectedTask.task_type` is shown raw — apply the same `typeConfig` lookup there for consistency.
