
# Populate CVE column in "Inventário de IPs Públicos"

## Problem

The CVE column always shows "0" because the current matching logic (`result?.vulns?.includes(c.cve_id)`) depends on the `vulns` array per IP, which is rarely populated by nmap. Meanwhile, the backend matches CVEs globally by extracting CPE product names from services and searching the `cve_cache` -- but this association is never stored per-IP.

## Solution

Replace the CVE matching logic in `IPDetailRow` to replicate the backend approach: extract CPE product names from each IP's services, then filter `snapshot.cve_matches` where the CVE's `products` array or title contains any of those product names. Also keep the existing `vulns` fallback.

### File: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Add a helper function** (near top, after existing helpers):

```typescript
function matchCVEsToIP(
  result: AttackSurfaceIPResult | undefined,
  cveMatches: AttackSurfaceCVE[]
): AttackSurfaceCVE[] {
  if (!result || cveMatches.length === 0) return [];

  // Collect CVE IDs from vulns (nmap vulners output)
  const vulnSet = new Set(result.vulns || []);

  // Extract product names from service CPEs (same logic as backend)
  const products = new Set<string>();
  for (const svc of result.services || []) {
    if (svc.cpe && Array.isArray(svc.cpe)) {
      for (const cpe of svc.cpe) {
        const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
        const product = (parts[2] || '').replace(/_/g, ' ').toLowerCase();
        if (product) products.add(product);
      }
    }
  }

  if (vulnSet.size === 0 && products.size === 0) return [];

  return cveMatches.filter((c) => {
    // Match by direct vuln ID
    if (vulnSet.has(c.cve_id)) return true;
    // Match by product name in CVE products array or title
    const titleLower = (c.title || '').toLowerCase();
    const cveProducts = (c.products || []).map(p => p.toLowerCase());
    for (const product of products) {
      if (titleLower.includes(product)) return true;
      if (cveProducts.some(cp => cp.includes(product))) return true;
    }
    return false;
  });
}
```

**2. Update line 555** in `IPDetailRow`:

```tsx
// Before
const ipCVEs = snapshot.cve_matches.filter((c) => result?.vulns?.includes(c.cve_id));

// After
const ipCVEs = matchCVEsToIP(result, snapshot.cve_matches);
```

No other changes needed -- the existing rendering logic (lines 616-621) already displays the count correctly.
