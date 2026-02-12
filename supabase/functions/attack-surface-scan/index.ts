import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a >= 224) return true
  return false
}

interface SourceIP {
  ip: string
  source: 'dns' | 'firewall'
  label: string
}

// ── Extract IPs from External Domain analyses ───────────────────────────────

function extractDomainIPs(reportData: any, domainName: string): SourceIP[] {
  const ips: SourceIP[] = []
  const seen = new Set<string>()

  if (!reportData) return ips

  // Path 1: subdomainSummary (from subdomain-enum edge function)
  const subSummary = reportData.subdomainSummary
  if (subSummary?.subdomains && Array.isArray(subSummary.subdomains)) {
    for (const sub of subSummary.subdomains) {
      if (sub.addresses && Array.isArray(sub.addresses)) {
        for (const addr of sub.addresses) {
          const ip = addr.ip || addr.value
          if (ip && !seen.has(ip) && !isPrivateIP(ip)) {
            seen.add(ip)
            ips.push({ ip, source: 'dns', label: `${sub.hostname || domainName}` })
          }
        }
      }
    }
  }

  // Path 2: checks[*].rawData - look for DNS-like data with IPs
  if (reportData.checks && Array.isArray(reportData.checks)) {
    for (const check of reportData.checks) {
      const raw = check.rawData
      if (!raw) continue

      // Look for A records or IP fields in raw data
      if (typeof raw === 'object') {
        const searchObj = (obj: any, depth = 0) => {
          if (depth > 5 || !obj) return
          if (Array.isArray(obj)) {
            for (const item of obj) searchObj(item, depth + 1)
          } else if (typeof obj === 'object') {
            // Check for ip field
            if (obj.ip && typeof obj.ip === 'string' && !seen.has(obj.ip) && !isPrivateIP(obj.ip)) {
              seen.add(obj.ip)
              ips.push({ ip: obj.ip, source: 'dns', label: obj.hostname || obj.name || domainName })
            }
            // Check for address field
            if (obj.address && typeof obj.address === 'string' && !seen.has(obj.address) && !isPrivateIP(obj.address)) {
              seen.add(obj.address)
              ips.push({ ip: obj.address, source: 'dns', label: obj.hostname || obj.name || domainName })
            }
            for (const key of Object.keys(obj)) {
              searchObj(obj[key], depth + 1)
            }
          }
        }
        searchObj(raw)
      }
    }
  }

  return ips
}

// ── Extract IPs from Firewall analyses (WAN interfaces) ─────────────────────

function extractFirewallIPs(stepResults: any[], firewallName: string): SourceIP[] {
  const ips: SourceIP[] = []
  const seen = new Set<string>()

  for (const step of stepResults) {
    if (step.step_id !== 'system_interface') continue

    const resultData = step.result_data
    if (!resultData) continue

    // result_data can be an object with results array or directly an array
    const interfaces = Array.isArray(resultData) 
      ? resultData 
      : (resultData.results || resultData.data || [])

    if (!Array.isArray(interfaces)) continue

    for (const iface of interfaces) {
      // Check if this is a WAN interface
      const name = (iface.name || '').toLowerCase()
      const role = (iface.role || '').toLowerCase()
      const type = (iface.type || '').toLowerCase()
      
      const isWAN = name.includes('wan') || role === 'wan' || type === 'wan'
      if (!isWAN) continue

      // Extract IP from "IP MASK" format
      const ipField = iface.ip || ''
      const ipOnly = ipField.split(' ')[0].trim()
      
      if (ipOnly && !seen.has(ipOnly) && !isPrivateIP(ipOnly)) {
        seen.add(ipOnly)
        ips.push({ ip: ipOnly, source: 'firewall', label: `${firewallName} - ${iface.name || 'WAN'}` })
      }
    }
  }

  return ips
}

// ── Shodan API ──────────────────────────────────────────────────────────────

interface ShodanResult {
  ip: string
  ports: number[]
  services: Array<{
    port: number
    transport: string
    product: string
    version: string
    banner: string
    cpe: string[]
  }>
  vulns: string[]
  os: string
  hostnames: string[]
  error?: string
}

async function queryShodan(ip: string, apiKey: string): Promise<ShodanResult> {
  const result: ShodanResult = {
    ip,
    ports: [],
    services: [],
    vulns: [],
    os: '',
    hostnames: [],
  }

  try {
    const resp = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      if (resp.status === 404) {
        result.error = 'No data available'
        return result
      }
      result.error = `Shodan API error: ${resp.status}`
      return result
    }

    const data = await resp.json()

    result.ports = data.ports || []
    result.os = data.os || ''
    result.hostnames = data.hostnames || []
    result.vulns = data.vulns ? Object.keys(data.vulns) : []

    if (data.data && Array.isArray(data.data)) {
      for (const svc of data.data) {
        result.services.push({
          port: svc.port || 0,
          transport: svc.transport || 'tcp',
          product: svc.product || '',
          version: svc.version || '',
          banner: (svc.data || '').substring(0, 500),
          cpe: svc.cpe || svc.cpe23 || [],
        })
      }
    }
  } catch (e) {
    result.error = `Request failed: ${(e as Error).message}`
  }

  return result
}

// ── CVE Correlation ─────────────────────────────────────────────────────────

async function correlateCVEs(
  shodanResults: ShodanResult[],
  supabase: any,
): Promise<any[]> {
  // Collect all CVE IDs from Shodan vulns
  const allVulnIds = new Set<string>()
  for (const r of shodanResults) {
    for (const v of r.vulns) {
      allVulnIds.add(v)
    }
  }

  if (allVulnIds.size === 0) return []

  // Check which ones exist in cve_cache
  const vulnArray = Array.from(allVulnIds)
  const matches: any[] = []

  // Query in batches of 50
  for (let i = 0; i < vulnArray.length; i += 50) {
    const batch = vulnArray.slice(i, i + 50)
    const { data } = await supabase
      .from('cve_cache')
      .select('cve_id, title, severity, score, advisory_url, products')
      .in('cve_id', batch)

    if (data) {
      matches.push(...data)
    }
  }

  // Also try to match by product/version from services CPE
  // This is a best-effort correlation
  const products = new Set<string>()
  for (const r of shodanResults) {
    for (const svc of r.services) {
      if (svc.product) products.add(svc.product.toLowerCase())
    }
  }

  return matches
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const shodanApiKey = Deno.env.get('SHODAN_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { client_id } = await req.json()
    if (!client_id) {
      return new Response(JSON.stringify({ error: 'client_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create snapshot record
    const { data: snapshot, error: snapError } = await supabase
      .from('attack_surface_snapshots')
      .insert({ client_id, status: 'processing' })
      .select('id')
      .single()

    if (snapError) throw snapError

    const snapshotId = snapshot.id

    try {
      // ── Step 1: Collect IPs ──────────────────────────────────────────

      const allIPs: SourceIP[] = []

      // 1a. From external domain analyses
      const { data: domains } = await supabase
        .from('external_domains')
        .select('id, domain, name')
        .eq('client_id', client_id)

      if (domains && domains.length > 0) {
        for (const domain of domains) {
          // Get latest completed analysis
          const { data: analyses } = await supabase
            .from('external_domain_analysis_history')
            .select('report_data')
            .eq('domain_id', domain.id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)

          if (analyses && analyses.length > 0 && analyses[0].report_data) {
            const domainIPs = extractDomainIPs(analyses[0].report_data, domain.domain)
            allIPs.push(...domainIPs)
          }
        }
      }

      // 1b. From firewall analyses (WAN interfaces via task_step_results)
      const { data: firewalls } = await supabase
        .from('firewalls')
        .select('id, name')
        .eq('client_id', client_id)

      if (firewalls && firewalls.length > 0) {
        for (const fw of firewalls) {
          // Get latest completed task for this firewall
          const { data: tasks } = await supabase
            .from('agent_tasks')
            .select('id')
            .eq('target_id', fw.id)
            .eq('target_type', 'firewall')
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)

          if (tasks && tasks.length > 0) {
            const { data: stepResults } = await supabase
              .from('task_step_results')
              .select('step_id, result_data')
              .eq('task_id', tasks[0].id)
              .eq('step_id', 'system_interface')

            if (stepResults) {
              const fwIPs = extractFirewallIPs(stepResults, fw.name)
              allIPs.push(...fwIPs)
            }
          }
        }
      }

      // Deduplicate IPs
      const uniqueIPs = Array.from(
        allIPs.reduce((map, item) => {
          if (!map.has(item.ip)) {
            map.set(item.ip, item)
          } else {
            // Merge sources
            const existing = map.get(item.ip)!
            if (existing.source !== item.source) {
              existing.source = 'dns' // keep first source, but label both
              existing.label = `${existing.label} + ${item.label}`
            }
          }
          return map
        }, new Map<string, SourceIP>())
        .values()
      )

      // ── Step 2: Query Shodan ─────────────────────────────────────────

      let shodanResults: ShodanResult[] = []

      if (shodanApiKey && uniqueIPs.length > 0) {
        // Rate limit: 1 req/sec for basic Shodan plan
        for (let i = 0; i < uniqueIPs.length; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 1100))
          const result = await queryShodan(uniqueIPs[i].ip, shodanApiKey)
          shodanResults.push(result)
        }
      } else if (!shodanApiKey) {
        // No Shodan key - just store IPs without enrichment
        console.warn('SHODAN_API_KEY not configured - skipping port scan enrichment')
      }

      // ── Step 3: Correlate CVEs ───────────────────────────────────────

      const cveMatches = await correlateCVEs(shodanResults, supabase)

      // ── Step 4: Build results ────────────────────────────────────────

      const resultsMap: Record<string, any> = {}
      let totalPorts = 0
      let totalServices = 0

      for (const sr of shodanResults) {
        totalPorts += sr.ports.length
        totalServices += sr.services.filter(s => s.product).length
        resultsMap[sr.ip] = {
          ports: sr.ports,
          services: sr.services,
          vulns: sr.vulns,
          os: sr.os,
          hostnames: sr.hostnames,
          error: sr.error,
        }
      }

      // Calculate exposure score (0-100, higher = more exposed)
      let score = 0
      if (uniqueIPs.length > 0) {
        const portScore = Math.min(totalPorts * 2, 40) // max 40 pts from ports
        const cveScore = Math.min(cveMatches.length * 5, 40) // max 40 pts from CVEs
        const ipScore = Math.min(uniqueIPs.length * 2, 20) // max 20 pts from IP count
        score = Math.min(portScore + cveScore + ipScore, 100)
      }

      // ── Step 5: Persist results ──────────────────────────────────────

      const summary = {
        total_ips: uniqueIPs.length,
        open_ports: totalPorts,
        services: totalServices,
        cves: cveMatches.length,
      }

      await supabase
        .from('attack_surface_snapshots')
        .update({
          status: 'completed',
          source_ips: uniqueIPs,
          results: resultsMap,
          cve_matches: cveMatches,
          summary,
          score,
          completed_at: new Date().toISOString(),
        })
        .eq('id', snapshotId)

      return new Response(
        JSON.stringify({ success: true, snapshot_id: snapshotId, summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (processError) {
      // Update snapshot as failed
      await supabase
        .from('attack_surface_snapshots')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          results: { error: (processError as Error).message },
        })
        .eq('id', snapshotId)

      throw processError
    }
  } catch (error) {
    console.error('Attack surface scan error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
