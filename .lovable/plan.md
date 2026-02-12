
# Fix: IP Extraction Mismatch in Attack Surface Queue

## Root Cause
The edge function `run-attack-surface-queue` cannot find any IPs because of **key name mismatches** between the extraction code and the actual `report_data` structure:

| Code expects | Actual data |
|---|---|
| `reportData.subdomainSummary` | `reportData.subdomain_summary` |
| `sub.hostname` | `sub.subdomain` |
| `reportData.subdomains` (top-level array) | Does not exist at top level |

The `addr.ip` field does match, but the parent paths are wrong so it never reaches that code.

## Fix

### File: `supabase/functions/run-attack-surface-queue/index.ts`

1. **Line 52**: Change `reportData.subdomainSummary` to `reportData.subdomain_summary`
2. **Line 60**: Change `sub.hostname` to `sub.subdomain`
3. Keep the camelCase fallback as a secondary check (for backward compatibility)
4. Also check `reportData.dns_summary` as an additional IP source

### Technical Details

The `extractDomainIPs` function needs these specific changes:

```text
// Line 52 - Fix key name (snake_case, not camelCase)
const subSummary = reportData.subdomain_summary || reportData.subdomainSummary

// Line 60 - Fix field name
ips.push({ ip, source: 'dns', label: sub.subdomain || sub.hostname || domainName })
```

### Deployment
- Deploy updated `run-attack-surface-queue` edge function
- No database or frontend changes needed
- After deploy, clicking "Disparar Scan" should correctly extract IPs and create tasks for the Super Agent
