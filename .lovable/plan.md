

## Fix TenantSelector: show domain only, always as dropdown

### Problem
1. The `TenantSelector` shows `displayName (domain)` which is too long (e.g., "BRASILUX IND. E COM. DE IMP. E EXP. LTDA (TASCHIBRA.mail.onmicrosoft.com)")
2. When there's only 1 tenant, it renders as static text instead of a dropdown selector

### Changes

**`src/components/m365/posture/TenantSelector.tsx`:**

- Remove the `tenants.length === 1` special case — always render the dropdown
- In the trigger button, show only `selectedTenant?.domain` instead of `displayName`
- In dropdown items, show `domain` as primary text and `displayName` as secondary smaller text
- Use the same `Select` component pattern or keep the DropdownMenu but with domain-only display

### Result
```
[TASCHIBRA.mail.onmicrosoft.com ▼]
```
Dropdown items show:
```
TASCHIBRA.mail.onmicrosoft.com
  BRASILUX IND. E COM. DE IMP. E EXP. LTDA
```

