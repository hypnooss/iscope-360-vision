import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MSRC_BASE = 'https://api.msrc.microsoft.com/cvrf/v3.0';

// M365 product name patterns to match in MSRC product tree
const M365_PRODUCT_PATTERNS = [
  'exchange server',
  'microsoft 365 apps',
  'microsoft office',
  'sharepoint',
  'azure active directory',
  'entra',
  'microsoft teams',
  'outlook',
  'defender',
  'intune',
  'onedrive',
  'microsoft 365',
];

interface MSRCUpdate {
  ID: string;
  Alias: string;
  DocumentTitle: string;
  Severity: string | null;
  InitialReleaseDate: string;
  CurrentReleaseDate: string;
}

interface CVEResult {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  score: number | null;
  products: string[];
  publishedDate: string;
  advisoryUrl: string;
  description: string;
}

function mapSeverity(sev: string | undefined | null): CVEResult['severity'] {
  if (!sev) return 'UNKNOWN';
  const s = sev.toLowerCase();
  if (s === 'critical') return 'CRITICAL';
  if (s === 'important' || s === 'high') return 'HIGH';
  if (s === 'moderate' || s === 'medium') return 'MEDIUM';
  if (s === 'low') return 'LOW';
  return 'UNKNOWN';
}

function matchesM365Products(productNames: string[], filterProducts: string[] | null): boolean {
  const patterns = filterProducts && filterProducts.length > 0
    ? filterProducts.map(p => p.toLowerCase())
    : M365_PRODUCT_PATTERNS;

  return productNames.some(name => {
    const lower = name.toLowerCase();
    return patterns.some(pattern => lower.includes(pattern));
  });
}

function getProductNames(vuln: any, productTree: any): string[] {
  const productIds = new Set<string>();
  const names: string[] = [];

  // Collect product IDs from ProductStatuses
  if (vuln.ProductStatuses) {
    for (const status of vuln.ProductStatuses) {
      if (status.ProductID) {
        for (const pid of status.ProductID) {
          productIds.add(pid);
        }
      }
    }
  }

  // Map product IDs to names from ProductTree
  if (productTree?.FullProductName) {
    for (const prod of productTree.FullProductName) {
      if (productIds.has(prod.ProductID)) {
        names.push(prod.Value);
      }
    }
  }

  return [...new Set(names)];
}

function extractCVSSScore(vuln: any): number | null {
  if (vuln.CVSSScoreSets) {
    for (const scoreSet of vuln.CVSSScoreSets) {
      if (scoreSet.BaseScore != null) {
        return parseFloat(scoreSet.BaseScore);
      }
    }
  }
  return null;
}

function extractDescription(vuln: any): string {
  if (vuln.Notes) {
    for (const note of vuln.Notes) {
      if (note.Type === 1 || note.Title === 'Description') {
        return note.Value || '';
      }
    }
    // Fallback to first note
    if (vuln.Notes.length > 0 && vuln.Notes[0].Value) {
      return vuln.Notes[0].Value;
    }
  }
  return '';
}

function getMaxSeverity(vuln: any): string | null {
  if (vuln.Threats) {
    for (const threat of vuln.Threats) {
      if (threat.Type === 3 && threat.Description?.Value) {
        return threat.Description.Value;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const months = parseInt(url.searchParams.get('months') || '3', 10);
    const productsParam = url.searchParams.get('products');
    const filterProducts = productsParam ? productsParam.split(',').map(p => p.trim()) : null;

    // 1. Get recent updates list
    const updatesRes = await fetch(`${MSRC_BASE}/updates`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!updatesRes.ok) {
      throw new Error(`MSRC updates API returned ${updatesRes.status}`);
    }

    const updatesData = await updatesRes.json();
    const updates: MSRCUpdate[] = updatesData.value || updatesData;

    // Sort by date descending and take requested months
    const sortedUpdates = updates
      .filter((u: MSRCUpdate) => u.ID && /^\d{4}-[A-Za-z]{3}$/.test(u.ID))
      .sort((a: MSRCUpdate, b: MSRCUpdate) => new Date(b.InitialReleaseDate).getTime() - new Date(a.InitialReleaseDate).getTime())
      .slice(0, Math.min(months, 6));

    const allCves: CVEResult[] = [];
    const seenCves = new Set<string>();

    // 2. For each month, fetch CVRF document
    for (const update of sortedUpdates) {
      try {
        const cvrfRes = await fetch(`${MSRC_BASE}/cvrf/${update.ID}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (!cvrfRes.ok) {
          console.warn(`Failed to fetch CVRF for ${update.ID}: ${cvrfRes.status}`);
          continue;
        }

        const cvrf = await cvrfRes.json();
        const productTree = cvrf.ProductTree;
        const vulnerabilities = cvrf.Vulnerability || [];

        for (const vuln of vulnerabilities) {
          const cveId = vuln.CVE;
          if (!cveId || seenCves.has(cveId)) continue;

          const productNames = getProductNames(vuln, productTree);

          // Filter: only M365-related products
          if (!matchesM365Products(productNames, filterProducts)) continue;

          seenCves.add(cveId);

          // Deduplicate and simplify product names
          const simplifiedProducts = [...new Set(productNames.map((name: string) => {
            // Extract the main product family name
            if (name.toLowerCase().includes('exchange')) return 'Exchange Server';
            if (name.toLowerCase().includes('sharepoint')) return 'SharePoint';
            if (name.toLowerCase().includes('teams')) return 'Teams';
            if (name.toLowerCase().includes('outlook')) return 'Outlook';
            if (name.toLowerCase().includes('entra') || name.toLowerCase().includes('azure active directory')) return 'Entra ID';
            if (name.toLowerCase().includes('defender')) return 'Defender';
            if (name.toLowerCase().includes('intune')) return 'Intune';
            if (name.toLowerCase().includes('onedrive')) return 'OneDrive';
            if (name.toLowerCase().includes('microsoft 365 apps') || name.toLowerCase().includes('microsoft office')) return 'Microsoft 365 Apps';
            return name;
          }))];

          const severity = mapSeverity(getMaxSeverity(vuln));
          const score = extractCVSSScore(vuln);
          const title = vuln.Title?.Value || cveId;
          const description = extractDescription(vuln);

          allCves.push({
            id: cveId,
            title,
            severity,
            score,
            products: simplifiedProducts,
            publishedDate: update.InitialReleaseDate?.split('T')[0] || '',
            advisoryUrl: `https://msrc.microsoft.com/update-guide/vulnerability/${cveId}`,
            description: description.substring(0, 500),
          });
        }
      } catch (err) {
        console.warn(`Error processing CVRF ${update.ID}:`, err);
      }
    }

    // Sort by score descending (nulls last), then by severity
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    allCves.sort((a, b) => {
      if (a.score != null && b.score != null) return b.score - a.score;
      if (a.score != null) return -1;
      if (b.score != null) return 1;
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    });

    return new Response(JSON.stringify({
      success: true,
      totalCVEs: allCves.length,
      cves: allCves,
      months: sortedUpdates.map((u: MSRCUpdate) => u.ID),
      source: 'Microsoft Security Response Center',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('m365-cves error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
