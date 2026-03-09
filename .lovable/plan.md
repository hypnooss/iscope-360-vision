

# Fix: MFA verification redirects back to challenge page

## Problem

After successful MFA verify, the flow is:
1. `mfa.verify()` succeeds → toast shows "Autenticação MFA concluída!"
2. `navigate('/dashboard')` fires
3. AppLayout renders → its MFA guard checks `mfaRequired` (still `true`) → redirects back to `/mfa/challenge`

The `onAuthStateChange` callback eventually calls `checkMfaStatus()` which would set `mfaRequired=false`, but it's too late — the guard already redirected.

## Fix

**File**: `src/pages/MfaChallengePage.tsx`

1. Import `useAuth` and get `refreshMfaStatus` from the auth context.
2. After successful `mfa.verify()`, call `await refreshMfaStatus()` **before** `navigate('/dashboard')`. This ensures `mfaRequired` is set to `false` in the context before AppLayout's guard runs.

```typescript
// Before navigate:
await refreshMfaStatus();
navigate('/dashboard', { replace: true });
```

This is a one-line addition that solves the race condition.

