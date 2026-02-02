const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CVEItem {
  id: string;
  description: string;
  affectedVersions?: string;
  severity: string;
  score: number;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
}

// Extrai apenas a parte da descrição relacionada ao FortiOS
function extractFortiOSInfo(fullDescription: string): {
  fortiOSDescription: string;
  affectedVersions: string;
  technicalDescription: string;
} {
  const descLower = fullDescription.toLowerCase();
  
  // Se não menciona FortiOS, retornar descrição original
  if (!descLower.includes('fortios')) {
    return {
      fortiOSDescription: fullDescription,
      affectedVersions: '',
      technicalDescription: fullDescription
    };
  }
  
  // Padrões comuns de versão FortiOS na descrição
  const fortiOSPattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?)\s*(?:through|to|before|and later|and earlier|-)\s*(\d+\.\d+(?:\.\d+)?)/gi;
  const fortiOSSinglePattern = /FortiOS\s+(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:\s*,?\s*\d+\.\d+(?:\.\d+)?)*)/gi;
  
  // Encontrar versões FortiOS afetadas
  let affectedVersions = '';
  const matches = fullDescription.match(fortiOSPattern);
  if (matches && matches.length > 0) {
    affectedVersions = matches.join(', ');
  } else {
    const singleMatches = fullDescription.match(fortiOSSinglePattern);
    if (singleMatches) {
      affectedVersions = singleMatches.join(', ');
    }
  }
  
  // Extrair a parte técnica da descrição
  const technicalPatterns = [
    /\b(allows?\s+.+)/i,
    /\b(may\s+allow\s+.+)/i,
    /\b(enables?\s+.+)/i,
    /\b(could\s+allow\s+.+)/i,
    /\b(permits?\s+.+)/i,
    /\b(makes?\s+it\s+possible\s+.+)/i,
  ];
  
  let technicalDescription = '';
  for (const pattern of technicalPatterns) {
    const techMatch = fullDescription.match(pattern);
    if (techMatch) {
      technicalDescription = techMatch[1];
      break;
    }
  }
  
  // Construir descrição focada no FortiOS
  let fortiOSDescription = '';
  if (affectedVersions) {
    fortiOSDescription = affectedVersions;
    if (technicalDescription) {
      fortiOSDescription += ' - ' + technicalDescription;
    }
  } else {
    const sentences = fullDescription.split(/[.;]/);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('fortios')) {
        fortiOSDescription = sentence.trim();
        break;
      }
    }
    if (!fortiOSDescription) {
      fortiOSDescription = fullDescription;
    }
  }
  
  return {
    fortiOSDescription: fortiOSDescription.substring(0, 400) + (fortiOSDescription.length > 400 ? '...' : ''),
    affectedVersions,
    technicalDescription: technicalDescription || fullDescription
  };
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
          cves = nvdData.vulnerabilities
            .filter((vuln: any) => {
              // Garantir que o CVE realmente afeta FortiOS
              const desc = vuln.cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '';
              return desc.toLowerCase().includes('fortios');
            })
            .map((vuln: any) => {
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
                if (score >= 9.0) severity = 'CRITICAL';
                else if (score >= 7.0) severity = 'HIGH';
                else if (score >= 4.0) severity = 'MEDIUM';
                else severity = 'LOW';
              }

              // Get description in English
              const fullDescription = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 
                                cve.descriptions?.[0]?.value || 'No description available';

              // Extrair apenas informações do FortiOS
              const fortiOSInfo = extractFortiOSInfo(fullDescription);

              // Get references
              const references = cve.references?.slice(0, 3).map((ref: any) => ref.url) || [];

              return {
                id: cve.id,
                description: fortiOSInfo.fortiOSDescription,
                affectedVersions: fortiOSInfo.affectedVersions,
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
                // Filtrar apenas CVEs que mencionam FortiOS
                const desc = vuln.cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '';
                return desc.toLowerCase().includes('fortios');
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

                const fullDescription = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 
                                  cve.descriptions?.[0]?.value || 'No description available';

                // Extrair apenas informações do FortiOS
                const fortiOSInfo = extractFortiOSInfo(fullDescription);

                const references = cve.references?.slice(0, 3).map((ref: any) => ref.url) || [];

                return {
                  id: cve.id,
                  description: fortiOSInfo.fortiOSDescription,
                  affectedVersions: fortiOSInfo.affectedVersions,
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
