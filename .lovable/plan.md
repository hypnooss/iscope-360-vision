

# Fix: Analyzer Blueprint - Incorrect API Endpoint Paths (404)

## Problem

All 5 collection steps return **HTTP 404** because the FortiGate REST API requires a **storage location** segment in log endpoint paths.

**Current (broken):** `/api/v2/log/traffic/forward`
**Correct format:** `/api/v2/log/{device}/traffic/forward`

Where `{device}` must be one of: `memory`, `disk`, `fortianalyzer`, `forticloud`.

The compliance blueprint works because it uses `/api/v2/cmdb/...` and `/api/v2/monitor/...` endpoints (which don't need a storage location). Log endpoints are different.

## Fix

Update each step's path in the analyzer blueprint, using `memory` as the default storage (always available; `disk` requires explicit disk logging enabled):

| Step ID | Current Path (404) | Corrected Path |
|---------|-------------------|----------------|
| denied_traffic | `/api/v2/log/traffic/forward?filter=action==deny&rows=500` | `/api/v2/log/memory/traffic/forward?filter=action==deny&rows=500` |
| auth_events | `/api/v2/log/event/system?filter=logdesc=~auth&rows=500` | `/api/v2/log/memory/event/system?filter=logdesc=~auth&rows=500` |
| vpn_events | `/api/v2/log/event/vpn?rows=500` | `/api/v2/log/memory/event/vpn?rows=500` |
| ips_events | `/api/v2/log/ips/forward?filter=severity<=2&rows=500` | `/api/v2/log/memory/ips/forward?filter=severity<=2&rows=500` |
| config_changes | `/api/v2/log/event/system?filter=logdesc=~config&rows=200` | `/api/v2/log/memory/event/system?filter=logdesc=~config&rows=200` |

The only change is inserting `/memory` after `/api/v2/log/`.

## Technical Details

| Resource | Change |
|----------|--------|
| SQL migration | `UPDATE device_blueprints SET collection_steps = ...` with corrected paths for the analyzer blueprint |

No frontend or edge function changes needed. After the migration, re-trigger the analysis.

