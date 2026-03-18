

## Problem

In **View Mode** (preview), the `useLicensingHub` hook fetches workspaces using `supabase.auth.getUser()`, which always returns the **real admin's** user ID — not the preview target user. This means:

1. `effectiveRole` correctly becomes the target user's role (e.g. `workspace_admin`)
2. Since `isSuperRole` is false, the `userWorkspaces` query runs
3. But `supabase.auth.getUser()` returns the **admin's ID**, so it fetches the **admin's** workspaces from `user_clients`
4. Result: data from the admin's workspaces is shown instead of the target user's workspaces

## Fix

In `src/hooks/useLicensingHub.ts`:

1. Import `usePreview` (or use `useEffectiveAuth` more fully) to detect preview mode and access `effectiveWorkspaces`
2. When in preview mode and not a super role, use `effectiveWorkspaces` (from `PreviewContext`) to derive `activeClientIds` instead of querying `user_clients` with the real admin's ID
3. Update the `activeClientIds` memo to prioritize preview workspaces when in preview mode

```text
activeClientIds logic (updated):
  if isSuperRole && selectedWorkspaceId → [selectedWorkspaceId]
  if isPreviewMode && effectiveWorkspaces → effectiveWorkspaces.map(w => w.id)
  if !isSuperRole && userWorkspaces       → userWorkspaces
  else                                     → []
```

Single file change: `src/hooks/useLicensingHub.ts`

