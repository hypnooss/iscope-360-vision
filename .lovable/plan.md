

## Fix: MFA Forte/Fraco showing 0 on cached data

### Problem
The `strong` and `weak` fields were just added to the backend response but old cached snapshots don't have them. The `?? 0` fallback makes both show as 0 instead of computing locally.

### Solution

In `EntraIdAnalyzerCategoryGrid.tsx` (lines 73-74), replace the simple `?? 0` fallback with a local computation when the backend fields are missing. This mirrors the original logic that was there before:

```typescript
case 'mfa_coverage': {
  const pct = mfa.total > 0 ? (mfa.enabled / mfa.total) * 100 : 0;
  
  // Use backend values if available, otherwise compute locally from userDetails
  let strong = mfa.strong;
  let weak = mfa.weak;
  
  if (strong == null || weak == null) {
    const STRONG_METHODS = ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'hardwareOneTimePasscode', 'windowsHelloForBusiness', 'passKeyDeviceBound', 'microsoftAuthenticatorPasswordless', 'fido2'];
    const details = mfa.userDetails || [];
    const strongCount = details.filter(u => u.hasMfa && u.methods.some(m => STRONG_METHODS.includes(m))).length;
    strong = strongCount;
    weak = Math.max(0, mfa.enabled - strongCount);
  }
  
  return {
    total: mfa.enabled,
    pct,
    severity: ...,
    splits: [
      { label: 'MFA Forte', value: strong, color: '#10b981' },
      { label: 'MFA Fraco', value: weak, color: '#f59e0b' },
      { label: 'Sem MFA', value: mfa.disabled, color: '#ef4444' },
    ],
  };
}
```

Single file change: `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx`, lines 71-84.

