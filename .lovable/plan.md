

## Bug Fix: WAN Interface Detection Including Tunnel Interfaces

### Problem

In the compliance evaluation engine (`agent-task-result/index.ts`), the `formatInterfaceSecurityEvidence` function (used for rules int-001 through int-005: HTTP, HTTPS, SSH, SNMP, Ping) determines WAN interfaces using **both role AND name**:

```typescript
const isWan = role === 'wan' || role === 'sd-wan' || 
              role.includes('wan') || 
              name.toLowerCase().includes('wan') ||    // <-- BUG
              name.toLowerCase().includes('sdwan') ||
              name.toLowerCase() === 'virtual-wan-link';
```

The `name.toLowerCase().includes('wan')` check matches tunnel interfaces like `SP01-WAN1`, `SP02-WAN1` which have `role: "undefined"` but contain "wan" in their name. This causes false positives — these tunnels are flagged as having ICMP Ping enabled on "WAN interfaces" when they are actually IPsec tunnel interfaces.

### Fix

**File**: `supabase/functions/agent-task-result/index.ts`, lines 2289-2294

Remove the name-based heuristic. WAN detection should rely **only on the `role` field** from FortiOS, plus special well-known SD-WAN virtual interfaces:

```typescript
// Check if it's a WAN or SD-WAN interface (by role only)
const isWan = role === 'wan' || role === 'sd-wan' || 
              role.includes('wan') || 
              name.toLowerCase() === 'virtual-wan-link' ||
              name.toLowerCase() === 'sd-wan' ||
              name.toLowerCase() === 'sdwan';
```

This removes `name.toLowerCase().includes('wan')` and `name.toLowerCase().includes('sdwan')`, keeping only exact matches for the well-known SD-WAN virtual interfaces that may not have a role set.

### Scope

- Only the `formatInterfaceSecurityEvidence` function (line 2290-2294) has this bug
- The `isWanInterface` helper (line 2612) and `formatInboundRuleEvidence` (line 2695) already use role-based detection correctly
- After deploying this edge function fix, a re-analysis of the affected firewall will produce correct results

