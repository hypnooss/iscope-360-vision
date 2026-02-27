

## Bug: Race condition between snapshot effects

### Root cause

Both `FirewallCompliancePage` and `ExternalDomainCompliancePage` have two competing effects:

1. **Effect A** (lines 302-306 / 165-169): "Auto-select latest snapshot" — sets `selectedSnapshotId` to first snapshot when snapshots load
2. **Effect B** (lines 308-310 / 172-174): "Reset snapshot when domain/firewall changes" — clears `selectedSnapshotId` to `''`

React runs effects in declaration order. When both fire in the same cycle (domain changes → new snapshots arrive), Effect A sets the snapshot, then Effect B immediately resets it to `''`. The report query never fires because `selectedSnapshotId` is empty, so the page shows "Nenhuma análise encontrada."

### Fix

**Remove Effect B entirely** from both pages. Effect A already handles domain/firewall changes correctly because the `snapshots` query key includes the selected domain/firewall ID — when the asset changes, snapshots refetch, and Effect A picks the first one. Replace Effect A with a version that always syncs to the first snapshot when snapshots change:

```ts
useEffect(() => {
  if (snapshots.length > 0) {
    setSelectedSnapshotId(snapshots[0].id);
  } else {
    setSelectedSnapshotId('');
  }
}, [snapshots]);
```

### Files changed

- `src/pages/firewall/FirewallCompliancePage.tsx` — replace Effect A (lines 165-169), remove Effect B (lines 172-174)
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx` — replace Effect A (lines 302-306), remove Effect B (lines 308-310)

