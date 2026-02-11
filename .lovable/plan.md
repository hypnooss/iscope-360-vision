

# Fix: Analyzer Blueprint Missing Authentication Headers

## Problem

All 5 steps in the "FortiGate - Analyzer" blueprint are returning **HTTP 401 Unauthorized** because they are missing the `Authorization` header. 

Comparing the two blueprints:

- **Compliance blueprint** (working): each step has `headers: { "Authorization": "Bearer {{api_key}}" }`
- **Analyzer blueprint** (broken): steps have NO `headers` field at all

The agent sends the HTTP requests exactly as configured in the blueprint, so without the auth header, the FortiGate API rejects every call.

## Fix

A single SQL migration to update the analyzer blueprint's `collection_steps`, adding the missing `headers` to all 5 steps:

| Step ID | Endpoint |
|---------|----------|
| denied_traffic | `/api/v2/log/traffic/forward?filter=action==deny&rows=500` |
| auth_events | `/api/v2/log/event/system?filter=logdesc=~auth&rows=500` |
| vpn_events | `/api/v2/log/event/vpn?rows=500` |
| ips_events | `/api/v2/log/ips/forward?filter=severity<=2&rows=500` |
| config_changes | `/api/v2/log/event/system?filter=logdesc=~config&rows=200` |

Each step will get:
```json
"headers": { "Authorization": "Bearer {{api_key}}" }
```

## Technical Details

| Resource | Change |
|----------|--------|
| SQL migration | `UPDATE device_blueprints SET collection_steps = ...` adding headers to all analyzer steps |

No frontend or edge function changes needed. After the migration, trigger the analysis again and the agent will authenticate correctly.

