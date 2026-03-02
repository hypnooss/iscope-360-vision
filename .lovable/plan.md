

## Bug: PIM-002 "Ativações de Role Recentes" showing only "User" for all entities

**Root cause:** In `supabase/functions/m365-check-pim/index.ts` line 151, the entity mapping uses only `a.principal?.displayName`, which returns "User" for all entries. The PIM beta endpoint's `$expand=principal` returns a minimal principal object. We need to also use `userPrincipalName` and include the role name for context.

### Change in `supabase/functions/m365-check-pim/index.ts`

**Line 149-153** — Improve entity mapping to show more useful information:

```typescript
affectedEntities: recentActivations.slice(0, 15).map((a: any) => ({
  id: a.id,
  displayName: a.principal?.displayName && a.principal.displayName !== 'User'
    ? a.principal.displayName
    : a.principal?.userPrincipalName || a.principal?.displayName || 'Usuário',
  userPrincipalName: a.principal?.userPrincipalName || '',
  details: {
    roleName: a.roleDefinition?.displayName || '',
    startDateTime: a.startDateTime,
    endDateTime: a.endDateTime,
  }
})),
```

Also update the Graph API query (line 126) to expand `roleDefinition` alongside `principal`:

```
$expand=principal,roleDefinition
```

### Change in RPC `get_posture_insights_lite`

The RPC extracts `e->>'displayName'` for the preview — this is correct and will now show the improved displayName. No RPC change needed.

### Files changed
| File | Change |
|------|--------|
| `m365-check-pim/index.ts` | Improve entity displayName fallback; expand roleDefinition; include UPN |

Requires edge function redeployment.

