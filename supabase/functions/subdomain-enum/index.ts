import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Types
// ============================================

interface SubdomainEnumRequest {
  domain: string;
  timeout?: number;
}

interface SubdomainEntry {
  subdomain: string;
  sources: string[];
  ips: string[];
  is_alive: boolean;
}

interface SubdomainEnumResponse {
  success: boolean;
  domain: string;
  total_found: number;
  alive_count: number;
  inactive_count: number;
  sources: string[];
  subdomains: SubdomainEntry[];
  errors?: string[];
  execution_time_ms: number;
}

// ============================================
// DNS-over-HTTPS Resolution (Cloudflare + Google fallback)
// ============================================

interface DoHAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DoHResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: Array<{ name: string; type: number }>;
  Answer?: DoHAnswer[];
}

/**
 * Resolve a hostname using DNS-over-HTTPS (Cloudflare primary, Google fallback).
 * Returns array of IP addresses (A records = type 1, AAAA records = type 28).
 */
async function resolveDNS(hostname: string, timeout = 5000): Promise<string[]> {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
  ];

  for (const url of providers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data: DoHResponse = await response.json();
      const ips: string[] = [];

      if (data.Answer) {
        for (const answer of data.Answer) {
          // Type 1 = A record, Type 28 = AAAA record
          if (answer.type === 1 || answer.type === 28) {
            ips.push(answer.data);
          }
        }
      }

      return ips;
    } catch {
      // Try next provider
      continue;
    }
  }

  return [];
}

/**
 * Resolve multiple subdomains in parallel with concurrency limit.
 */
async function resolveSubdomains(
  subdomains: Map<string, { sources: string[] }>,
  maxConcurrent = 20,
  timeout = 3000
): Promise<SubdomainEntry[]> {
  const entries = Array.from(subdomains.entries());
  const results: SubdomainEntry[] = [];

  // Process in batches
  for (let i = 0; i < entries.length; i += maxConcurrent) {
    const batch = entries.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(async ([subdomain, data]) => {
        const ips = await resolveDNS(subdomain, timeout);
        return {
          subdomain,
          sources: data.sources,
          ips,
          is_alive: ips.length > 0,
        };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================
// Subdomain Discovery APIs
// ============================================

/**
 * Validate if a subdomain is valid for the given domain.
 */
function isValidSubdomain(subdomain: string, domain: string): boolean {
  if (!subdomain || !domain) return false;
  
  const cleanSub = subdomain.toLowerCase().trim();
  const cleanDomain = domain.toLowerCase().trim();
  
  // Must end with the domain
  if (!cleanSub.endsWith(cleanDomain)) return false;
  
  // Must not be the domain itself
  if (cleanSub === cleanDomain) return false;
  
  // Basic validation: only alphanumeric, hyphens, and dots
  if (!/^[a-z0-9.-]+$/.test(cleanSub)) return false;
  
  // No double dots or leading/trailing dots
  if (cleanSub.includes('..') || cleanSub.startsWith('.') || cleanSub.endsWith('.')) return false;
  
  return true;
}

/**
 * Query crt.sh Certificate Transparency logs.
 */
async function queryCrtsh(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://crt.sh/?q=%25.${domain}&output=json`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    for (const cert of data) {
      const nameValue = cert.name_value || '';
      // Split by newline (wildcard certs may have multiple names)
      for (const name of nameValue.split('\n')) {
        const cleaned = name.trim().toLowerCase().replace(/^\*\./, '');
        if (isValidSubdomain(cleaned, domain)) {
          subdomains.add(cleaned);
        }
      }
    }
  } catch (e) {
    console.log(`crt.sh error: ${e}`);
  }

  return subdomains;
}

/**
 * Query HackerTarget API (100 free requests/day).
 */
async function queryHackerTarget(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://api.hackertarget.com/hostsearch/?q=${domain}`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const text = await response.text();
    
    // Format: subdomain,ip
    for (const line of text.trim().split('\n')) {
      if (line.includes(',')) {
        const subdomain = line.split(',')[0].trim().toLowerCase();
        if (isValidSubdomain(subdomain, domain)) {
          subdomains.add(subdomain);
        }
      }
    }
  } catch (e) {
    console.log(`hackertarget error: ${e}`);
  }

  return subdomains;
}

/**
 * Query AlienVault OTX passive DNS.
 */
async function queryAlienVault(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://otx.alienvault.com/api/v1/indicators/domain/${domain}/passive_dns`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    for (const record of data.passive_dns || []) {
      const hostname = (record.hostname || '').trim().toLowerCase();
      if (isValidSubdomain(hostname, domain)) {
        subdomains.add(hostname);
      }
    }
  } catch (e) {
    console.log(`alienvault error: ${e}`);
  }

  return subdomains;
}

/**
 * Query RapidDNS.io for subdomains.
 */
async function queryRapidDNS(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://rapiddns.io/subdomain/${domain}?full=1`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const text = await response.text();
    
    // Parse HTML response - subdomains are in <td> tags
    const pattern = new RegExp(`<td>([a-zA-Z0-9.-]+\\.${domain.replace(/\./g, '\\.')})</td>`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim().toLowerCase();
      if (isValidSubdomain(name, domain)) {
        subdomains.add(name);
      }
    }
  } catch (e) {
    console.log(`rapiddns error: ${e}`);
  }

  return subdomains;
}

/**
 * Query ThreatMiner API for subdomains.
 */
async function queryThreatMiner(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://api.threatminer.org/v2/domain.php?q=${domain}&rt=5`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    if (data.status_code === '200') {
      for (const subdomain of data.results || []) {
        const name = subdomain.trim().toLowerCase();
        if (isValidSubdomain(name, domain)) {
          subdomains.add(name);
        }
      }
    }
  } catch (e) {
    console.log(`threatminer error: ${e}`);
  }

  return subdomains;
}

/**
 * Query URLScan.io for subdomains (100 requests/day free).
 */
async function queryURLScan(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://urlscan.io/api/v1/search/?q=domain:${domain}`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    for (const result of data.results || []) {
      const pageDomain = (result.task?.domain || '').trim().toLowerCase();
      if (isValidSubdomain(pageDomain, domain)) {
        subdomains.add(pageDomain);
      }
    }
  } catch (e) {
    console.log(`urlscan error: ${e}`);
  }

  return subdomains;
}

/**
 * Query Wayback Machine CDX API for historical subdomains.
 */
async function queryWayback(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&fl=original&collapse=urlkey`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const text = await response.text();
    if (!text.trim()) return subdomains;

    const data = JSON.parse(text);
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      
      const urlStr = Array.isArray(row) ? row[0] : row;
      // Extract domain from URL: https://subdomain.domain.com/path -> subdomain.domain.com
      const match = /https?:\/\/([^/]+)/.exec(urlStr);
      if (match) {
        const hostname = match[1].split(':')[0].toLowerCase();
        if (isValidSubdomain(hostname, domain)) {
          subdomains.add(hostname);
        }
      }
    }
  } catch (e) {
    console.log(`wayback error: ${e}`);
  }

  return subdomains;
}

/**
 * Query CertSpotter API for certificate transparency data.
 */
async function queryCertSpotter(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://api.certspotter.com/v1/issuances?domain=${domain}&include_subdomains=true&expand=dns_names`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    for (const cert of data) {
      for (const name of cert.dns_names || []) {
        const cleaned = name.trim().toLowerCase().replace(/^\*\./, '');
        if (isValidSubdomain(cleaned, domain)) {
          subdomains.add(cleaned);
        }
      }
    }
  } catch (e) {
    console.log(`certspotter error: ${e}`);
  }

  return subdomains;
}

/**
 * Query JLDC Anubis API for subdomains.
 */
async function queryJLDC(domain: string, timeout: number): Promise<Set<string>> {
  const url = `https://jldc.me/anubis/subdomains/${domain}`;
  const subdomains = new Set<string>();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return subdomains;

    const data = await response.json();
    
    for (const subdomain of data) {
      const name = subdomain.trim().toLowerCase();
      if (isValidSubdomain(name, domain)) {
        subdomains.add(name);
      }
    }
  } catch (e) {
    console.log(`jldc error: ${e}`);
  }

  return subdomains;
}

// ============================================
// Main Enumeration Function
// ============================================

async function enumerateSubdomains(domain: string, apiTimeout = 15000): Promise<SubdomainEnumResponse> {
  const startTime = Date.now();
  const allSubdomains = new Map<string, { sources: string[] }>();
  const sourcesUsed: string[] = [];
  const errors: string[] = [];

  // Clean domain
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];

  console.log(`[subdomain-enum] Starting enumeration for ${cleanDomain}`);

  // Query all APIs in parallel
  const apiQueries = [
    { name: 'crt.sh', fn: () => queryCrtsh(cleanDomain, apiTimeout) },
    { name: 'hackertarget', fn: () => queryHackerTarget(cleanDomain, apiTimeout) },
    { name: 'alienvault', fn: () => queryAlienVault(cleanDomain, apiTimeout) },
    { name: 'rapiddns', fn: () => queryRapidDNS(cleanDomain, apiTimeout) },
    { name: 'threatminer', fn: () => queryThreatMiner(cleanDomain, apiTimeout) },
    { name: 'urlscan', fn: () => queryURLScan(cleanDomain, apiTimeout) },
    { name: 'wayback', fn: () => queryWayback(cleanDomain, apiTimeout) },
    { name: 'certspotter', fn: () => queryCertSpotter(cleanDomain, apiTimeout) },
    { name: 'jldc', fn: () => queryJLDC(cleanDomain, apiTimeout) },
  ];

  const results = await Promise.allSettled(apiQueries.map(async (api) => {
    try {
      const subs = await api.fn();
      return { name: api.name, subdomains: subs };
    } catch (e) {
      return { name: api.name, error: String(e), subdomains: new Set<string>() };
    }
  }));

  // Process results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, subdomains, error } = result.value as { name: string; subdomains: Set<string>; error?: string };
      
      if (error) {
        errors.push(`${name}: ${error}`);
      }

      if (subdomains.size > 0) {
        sourcesUsed.push(`${name} (${subdomains.size})`);
        
        for (const sub of subdomains) {
          if (allSubdomains.has(sub)) {
            const existing = allSubdomains.get(sub)!;
            if (!existing.sources.includes(name)) {
              existing.sources.push(name);
            }
          } else {
            allSubdomains.set(sub, { sources: [name] });
          }
        }
      }
    } else {
      errors.push(`API query failed: ${result.reason}`);
    }
  }

  console.log(`[subdomain-enum] Found ${allSubdomains.size} unique subdomains from ${sourcesUsed.length} sources`);

  // Limit DNS resolution to avoid timeout (max ~200 subdomains for 30s edge function limit)
  const maxResolutions = 200;
  let subdomainsToResolve = allSubdomains;
  
  if (allSubdomains.size > maxResolutions) {
    console.log(`[subdomain-enum] Limiting DNS resolution to ${maxResolutions} subdomains (found ${allSubdomains.size})`);
    // Take first N entries
    const entries = Array.from(allSubdomains.entries()).slice(0, maxResolutions);
    subdomainsToResolve = new Map(entries);
  }

  // Resolve subdomains via DNS-over-HTTPS
  console.log(`[subdomain-enum] Resolving ${subdomainsToResolve.size} subdomains via DoH...`);
  const resolvedSubdomains = await resolveSubdomains(subdomainsToResolve, 25, 3000);

  // Add any remaining subdomains that weren't resolved (mark as is_alive: false)
  if (allSubdomains.size > maxResolutions) {
    const resolvedSet = new Set(resolvedSubdomains.map(s => s.subdomain));
    for (const [sub, data] of allSubdomains.entries()) {
      if (!resolvedSet.has(sub)) {
        resolvedSubdomains.push({
          subdomain: sub,
          sources: data.sources,
          ips: [],
          is_alive: false,
        });
      }
    }
  }

  // Sort results
  resolvedSubdomains.sort((a, b) => a.subdomain.localeCompare(b.subdomain));

  const aliveCount = resolvedSubdomains.filter(s => s.is_alive).length;
  const inactiveCount = resolvedSubdomains.length - aliveCount;
  const executionTime = Date.now() - startTime;

  console.log(`[subdomain-enum] Completed in ${executionTime}ms: ${aliveCount} alive, ${inactiveCount} inactive`);

  return {
    success: true,
    domain: cleanDomain,
    total_found: resolvedSubdomains.length,
    alive_count: aliveCount,
    inactive_count: inactiveCount,
    sources: sourcesUsed,
    subdomains: resolvedSubdomains,
    errors: errors.length > 0 ? errors : undefined,
    execution_time_ms: executionTime,
  };
}

// ============================================
// HTTP Handler
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: SubdomainEnumRequest = await req.json();
    
    if (!body.domain) {
      return new Response(
        JSON.stringify({ error: 'Missing domain parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default API timeout (15s to leave room for DNS resolution)
    const timeout = (body.timeout || 15) * 1000;
    
    console.log(`[subdomain-enum] Request for domain: ${body.domain}`);
    
    const result = await enumerateSubdomains(body.domain, timeout);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[subdomain-enum] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        domain: '',
        total_found: 0,
        alive_count: 0,
        inactive_count: 0,
        sources: [],
        subdomains: [],
        execution_time_ms: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
