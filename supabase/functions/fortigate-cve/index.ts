const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CVEItem {
  id: string;
  description: string;
  severity: string;
  score: number;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { version } = await req.json();

    if (!version) {
      return new Response(
        JSON.stringify({ success: false, error: 'Version is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching CVEs for FortiOS version: ${version}`);

    // Parse version to create search range
    const versionParts = version.replace('v', '').split('.');
    const majorMinor = versionParts.slice(0, 2).join('.');
    
    // Build NVD API query for FortiOS CVEs
    // Using CPE match for fortinet:fortios
    const cpeMatch = `cpe:2.3:o:fortinet:fortios:${version.replace('v', '')}:*:*:*:*:*:*:*`;
    
    // NVD API 2.0 endpoint
    const nvdUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
    nvdUrl.searchParams.set('cpeName', cpeMatch);
    
    console.log(`Querying NVD API: ${nvdUrl.toString()}`);

    let cves: CVEItem[] = [];

    try {
      const nvdResponse = await fetch(nvdUrl.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (nvdResponse.ok) {
        const nvdData = await nvdResponse.json();
        console.log(`NVD returned ${nvdData.totalResults || 0} results`);

        if (nvdData.vulnerabilities && nvdData.vulnerabilities.length > 0) {
          cves = nvdData.vulnerabilities.map((vuln: any) => {
            const cve = vuln.cve;
            
            // Get CVSS score and severity
            let score = 0;
            let severity = 'UNKNOWN';
            
            if (cve.metrics?.cvssMetricV31?.[0]) {
              score = cve.metrics.cvssMetricV31[0].cvssData.baseScore;
              severity = cve.metrics.cvssMetricV31[0].cvssData.baseSeverity;
            } else if (cve.metrics?.cvssMetricV30?.[0]) {
              score = cve.metrics.cvssMetricV30[0].cvssData.baseScore;
              severity = cve.metrics.cvssMetricV30[0].cvssData.baseSeverity;
            } else if (cve.metrics?.cvssMetricV2?.[0]) {
              score = cve.metrics.cvssMetricV2[0].cvssData.baseScore;
              // Convert V2 score to severity
              if (score >= 9.0) severity = 'CRITICAL';
              else if (score >= 7.0) severity = 'HIGH';
              else if (score >= 4.0) severity = 'MEDIUM';
              else severity = 'LOW';
            }

            // Get description in English
            const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 
                              cve.descriptions?.[0]?.value || 'No description available';

            // Get references
            const references = cve.references?.slice(0, 3).map((ref: any) => ref.url) || [];

            return {
              id: cve.id,
              description: description.substring(0, 500) + (description.length > 500 ? '...' : ''),
              severity,
              score,
              publishedDate: cve.published,
              lastModifiedDate: cve.lastModified,
              references,
            };
          });
        }
      } else {
        console.log(`NVD API returned status ${nvdResponse.status}, trying keyword search`);
      }
    } catch (nvdError) {
      console.log(`CPE search failed: ${nvdError}, trying keyword search`);
    }

    // If CPE search returned no results, try keyword search
    if (cves.length === 0) {
      const keywordUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
      keywordUrl.searchParams.set('keywordSearch', `FortiOS ${majorMinor}`);
      keywordUrl.searchParams.set('resultsPerPage', '20');
      
      console.log(`Trying keyword search: ${keywordUrl.toString()}`);

      try {
        const keywordResponse = await fetch(keywordUrl.toString(), {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (keywordResponse.ok) {
          const keywordData = await keywordResponse.json();
          console.log(`Keyword search returned ${keywordData.totalResults || 0} results`);

          if (keywordData.vulnerabilities && keywordData.vulnerabilities.length > 0) {
            cves = keywordData.vulnerabilities
              .filter((vuln: any) => {
                // Filter to only include CVEs that mention this version or are generic FortiOS
                const desc = vuln.cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '';
                return desc.toLowerCase().includes('fortios') || desc.toLowerCase().includes('fortigate');
              })
              .slice(0, 15)
              .map((vuln: any) => {
                const cve = vuln.cve;
                
                let score = 0;
                let severity = 'UNKNOWN';
                
                if (cve.metrics?.cvssMetricV31?.[0]) {
                  score = cve.metrics.cvssMetricV31[0].cvssData.baseScore;
                  severity = cve.metrics.cvssMetricV31[0].cvssData.baseSeverity;
                } else if (cve.metrics?.cvssMetricV30?.[0]) {
                  score = cve.metrics.cvssMetricV30[0].cvssData.baseScore;
                  severity = cve.metrics.cvssMetricV30[0].cvssData.baseSeverity;
                } else if (cve.metrics?.cvssMetricV2?.[0]) {
                  score = cve.metrics.cvssMetricV2[0].cvssData.baseScore;
                  if (score >= 9.0) severity = 'CRITICAL';
                  else if (score >= 7.0) severity = 'HIGH';
                  else if (score >= 4.0) severity = 'MEDIUM';
                  else severity = 'LOW';
                }

                const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 
                                  cve.descriptions?.[0]?.value || 'No description available';

                const references = cve.references?.slice(0, 3).map((ref: any) => ref.url) || [];

                return {
                  id: cve.id,
                  description: description.substring(0, 500) + (description.length > 500 ? '...' : ''),
                  severity,
                  score,
                  publishedDate: cve.published,
                  lastModifiedDate: cve.lastModified,
                  references,
                };
              });
          }
        }
      } catch (keywordError) {
        console.log(`Keyword search also failed: ${keywordError}`);
      }
    }

    // Sort by score (highest first)
    cves.sort((a, b) => b.score - a.score);

    console.log(`Returning ${cves.length} CVEs`);

    return new Response(
      JSON.stringify({
        success: true,
        version,
        totalCVEs: cves.length,
        cves,
        source: 'NIST National Vulnerability Database',
        disclaimer: 'Esta é uma lista informativa de CVEs conhecidos. Verifique os advisories oficiais da Fortinet para informações precisas sobre versões afetadas.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching CVEs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch CVEs';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
