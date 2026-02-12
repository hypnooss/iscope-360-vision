import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Crypto helpers (same as manage-api-keys) ────────────────────────────────

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function decryptSecret(encryptedData: string): Promise<string> {
  const encryptionKeyHex = Deno.env.get('M365_ENCRYPTION_KEY')
  if (!encryptionKeyHex) throw new Error('M365_ENCRYPTION_KEY not configured')

  const [ivHex, ciphertextHex] = encryptedData.split(':')
  if (!ivHex || !ciphertextHex) return encryptedData

  const iv = fromHex(ivHex)
  const ciphertext = fromHex(ciphertextHex)
  const keyBytes = fromHex(encryptionKeyHex)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
  return new TextDecoder().decode(decrypted)
}

// ── Resolve API key: DB (encrypted) → env fallback ─────────────────────────

async function resolveApiKey(supabase: any, keyName: string): Promise<string | null> {
  try {
    const settingsKey = `api_key_${keyName}`
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle()

    if (data?.value) {
      const raw = typeof data.value === 'string' ? data.value : JSON.stringify(data.value)
      const clean = raw.replace(/^"|"$/g, '')
      return await decryptSecret(clean)
    }
  } catch (e) {
    console.warn(`Failed to read ${keyName} from DB:`, (e as Error).message)
  }

  return Deno.env.get(keyName) || null
}

// ── IP helpers ──────────────────────────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true // APIPA / link-local
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

  // Path 0: subdomain enumeration format
  if (reportData.subdomains && Array.isArray(reportData.subdomains)) {
    for (const sub of reportData.subdomains) {
      if (sub.ips && Array.isArray(sub.ips)) {
        for (const ip of sub.ips) {
          if (typeof ip === 'string' && !seen.has(ip) && !isPrivateIP(ip)) {
            seen.add(ip)
            ips.push({ ip, source: 'dns', label: sub.subdomain || domainName })
          }
        }
      }
    }
  }

  // Path 1: subdomainSummary
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

  // Path 2: checks[*].rawData
  if (reportData.checks && Array.isArray(reportData.checks)) {
    for (const check of reportData.checks) {
      const raw = check.rawData
      if (!raw) continue
      if (typeof raw === 'object') {
        const searchObj = (obj: any, depth = 0) => {
          if (depth > 5 || !obj) return
          if (Array.isArray(obj)) {
            for (const item of obj) searchObj(item, depth + 1)
          } else if (typeof obj === 'object') {
            if (obj.ip && typeof obj.ip === 'string' && !seen.has(obj.ip) && !isPrivateIP(obj.ip)) {
              seen.add(obj.ip)
              ips.push({ ip: obj.ip, source: 'dns', label: obj.hostname || obj.name || domainName })
            }
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
    const resultData = step.data
    if (!resultData) continue
    const interfaces = Array.isArray(resultData)
      ? resultData
      : (resultData.results || resultData.data || [])
    if (!Array.isArray(interfaces)) continue

    for (const iface of interfaces) {
      const name = (iface.name || '').toLowerCase()
      const role = (iface.role || '').toLowerCase()
      const type = (iface.type || '').toLowerCase()
      const isWAN = name.includes('wan') || role === 'wan' || type === 'wan'
      if (!isWAN) continue

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

// ── Enrichment result type ──────────────────────────────────────────────────

type EnrichmentSource = 'shodan' | 'internetdb' | 'securitytrails' | 'mixed' | 'none'

interface EnrichedIP {
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
  tags: string[]
  enrichment_source: EnrichmentSource
  error?: string
}

// ── Shodan API (primary) ────────────────────────────────────────────────────

async function queryShodan(ip: string, apiKey: string): Promise<EnrichedIP | null> {
  try {
    const resp = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      // 403 = plan restriction, 404 = no data → fallback
      return null
    }

    const data = await resp.json()
    const services: EnrichedIP['services'] = []

    if (data.data && Array.isArray(data.data)) {
      for (const svc of data.data) {
        services.push({
          port: svc.port || 0,
          transport: svc.transport || 'tcp',
          product: svc.product || '',
          version: svc.version || '',
          banner: (svc.data || '').substring(0, 500),
          cpe: svc.cpe || svc.cpe23 || [],
        })
      }
    }

    return {
      ip,
      ports: data.ports || [],
      services,
      vulns: data.vulns ? Object.keys(data.vulns) : [],
      os: data.os || '',
      hostnames: data.hostnames || [],
      tags: data.tags || [],
      enrichment_source: 'shodan',
    }
  } catch (e) {
    console.warn(`Shodan API failed for ${ip}: ${(e as Error).message}`)
    return null
  }
}

// ── Shodan InternetDB (free, no auth) ───────────────────────────────────────

async function queryInternetDB(ip: string): Promise<EnrichedIP | null> {
  try {
    const resp = await fetch(`https://internetdb.shodan.io/${ip}`, {
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      if (resp.status === 404) return null // No data for this IP
      return null
    }

    const data = await resp.json()

    // InternetDB returns: { ip, ports, cpes, hostnames, tags, vulns }
    const services: EnrichedIP['services'] = []
    const ports: number[] = data.ports || []
    const cpes: string[] = data.cpes || []

    // Build basic services from ports + CPEs
    for (const port of ports) {
      // Try to match a CPE to this port (best effort)
      const matchedCpe = cpes.find(c => c.includes(`:${port}`)) || ''
      services.push({
        port,
        transport: 'tcp',
        product: matchedCpe ? matchedCpe.split(':')[4] || '' : '',
        version: matchedCpe ? matchedCpe.split(':')[5] || '' : '',
        banner: '',
        cpe: matchedCpe ? [matchedCpe] : [],
      })
    }

    return {
      ip,
      ports,
      services,
      vulns: data.vulns || [],
      os: '',
      hostnames: data.hostnames || [],
      tags: data.tags || [],
      enrichment_source: 'internetdb',
    }
  } catch (e) {
    console.warn(`InternetDB failed for ${ip}: ${(e as Error).message}`)
    return null
  }
}

// ── SecurityTrails (reverse DNS) ────────────────────────────────────────────

interface SecurityTrailsData {
  hostnames: string[]
  domains: string[]
}

async function querySecurityTrails(ip: string, apiKey: string): Promise<SecurityTrailsData | null> {
  try {
    // Use the IP neighbors/reverse DNS endpoint
    const resp = await fetch(`https://api.securitytrails.com/v1/ips/nearby/${ip}`, {
      headers: { 'APIKEY': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      console.warn(`SecurityTrails API error for ${ip}: ${resp.status}`)
      return null
    }

    const data = await resp.json()
    const hostnames: string[] = []
    const domains = new Set<string>()

    // Extract blocks with hostnames
    if (data.blocks && Array.isArray(data.blocks)) {
      for (const block of data.blocks) {
        if (block.hostnames && Array.isArray(block.hostnames)) {
          for (const h of block.hostnames) {
            if (typeof h === 'string') {
              hostnames.push(h)
              // Extract root domain
              const parts = h.split('.')
              if (parts.length >= 2) {
                domains.add(parts.slice(-2).join('.'))
              }
            }
          }
        }
      }
    }

    return { hostnames, domains: Array.from(domains) }
  } catch (e) {
    console.warn(`SecurityTrails failed for ${ip}: ${(e as Error).message}`)
    return null
  }
}

// ── Enrichment orchestrator (cascade) ───────────────────────────────────────

async function enrichIP(
  ip: string,
  shodanApiKey: string | null,
  securityTrailsApiKey: string | null,
): Promise<EnrichedIP> {
  // Start with empty result
  let result: EnrichedIP = {
    ip,
    ports: [],
    services: [],
    vulns: [],
    os: '',
    hostnames: [],
    tags: [],
    enrichment_source: 'none',
  }

  // Step 1: Try Shodan primary API
  if (shodanApiKey) {
    const shodanResult = await queryShodan(ip, shodanApiKey)
    if (shodanResult) {
      result = shodanResult
    }
  }

  // Step 2: If Shodan failed or no key, try InternetDB
  if (result.enrichment_source === 'none') {
    const idbResult = await queryInternetDB(ip)
    if (idbResult) {
      result = idbResult
    }
  }

  // Step 3: Complement with SecurityTrails
  if (securityTrailsApiKey) {
    const stData = await querySecurityTrails(ip, securityTrailsApiKey)
    if (stData) {
      // Merge hostnames (deduplicate)
      const existingHostnames = new Set(result.hostnames)
      for (const h of stData.hostnames) {
        if (!existingHostnames.has(h)) {
          result.hostnames.push(h)
        }
      }
      // Update source
      if (result.enrichment_source !== 'none') {
        result.enrichment_source = 'mixed'
      } else {
        result.enrichment_source = 'securitytrails'
      }
    }
  }

  return result
}

// ── CVE Correlation ─────────────────────────────────────────────────────────

async function correlateCVEs(
  enrichedResults: EnrichedIP[],
  supabase: any,
): Promise<any[]> {
  const allVulnIds = new Set<string>()
  for (const r of enrichedResults) {
    for (const v of r.vulns) {
      allVulnIds.add(v)
    }
  }

  if (allVulnIds.size === 0) return []

  const vulnArray = Array.from(allVulnIds)
  const matches: any[] = []

  for (let i = 0; i < vulnArray.length; i += 50) {
    const batch = vulnArray.slice(i, i + 50)
    const { data } = await supabase
      .from('cve_cache')
      .select('cve_id, title, severity, score, advisory_url, products')
      .in('cve_id', batch)

    if (data) matches.push(...data)
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { client_id } = await req.json()
    if (!client_id) {
      return new Response(JSON.stringify({ error: 'client_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve API keys: DB (encrypted) → env fallback
    const [shodanApiKey, securityTrailsApiKey] = await Promise.all([
      resolveApiKey(supabase, 'SHODAN_API_KEY'),
      resolveApiKey(supabase, 'SECURITYTRAILS_API_KEY'),
    ])

    console.log(`API keys resolved — Shodan: ${shodanApiKey ? 'yes' : 'no'}, SecurityTrails: ${securityTrailsApiKey ? 'yes' : 'no'}`)

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
          const { data: analyses } = await supabase
            .from('external_domain_analysis_history')
            .select('report_data, source')
            .eq('domain_id', domain.id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(5)

          if (analyses && analyses.length > 0) {
            for (const analysis of analyses) {
              if (analysis.report_data) {
                const domainIPs = extractDomainIPs(analysis.report_data, domain.domain)
                allIPs.push(...domainIPs)
              }
            }
          }
        }
      }

      // 1b. From firewall analyses (WAN interfaces)
      const { data: firewalls } = await supabase
        .from('firewalls')
        .select('id, name')
        .eq('client_id', client_id)

      if (firewalls && firewalls.length > 0) {
        for (const fw of firewalls) {
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
              .select('step_id, data')
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
            const existing = map.get(item.ip)!
            if (existing.source !== item.source) {
              existing.source = 'dns'
              existing.label = `${existing.label} + ${item.label}`
            }
          }
          return map
        }, new Map<string, SourceIP>()).values(),
      )

      console.log(`Collected ${uniqueIPs.length} unique public IPs for enrichment`)

      // ── Step 2: Enrich IPs (cascade: Shodan → InternetDB → SecurityTrails) ─

      const enrichedResults: EnrichedIP[] = []

      for (let i = 0; i < uniqueIPs.length; i++) {
        // Rate limit: ~1 req/sec for Shodan, ~2 req/sec for SecurityTrails
        if (i > 0) await new Promise(r => setTimeout(r, 1100))

        const result = await enrichIP(uniqueIPs[i].ip, shodanApiKey, securityTrailsApiKey)
        enrichedResults.push(result)

        console.log(`[${i + 1}/${uniqueIPs.length}] ${result.ip}: ${result.enrichment_source} — ${result.ports.length} ports, ${result.vulns.length} vulns`)
      }

      // ── Step 3: Correlate CVEs ───────────────────────────────────────

      const cveMatches = await correlateCVEs(enrichedResults, supabase)

      // ── Step 4: Build results ────────────────────────────────────────

      const resultsMap: Record<string, any> = {}
      let totalPorts = 0
      let totalServices = 0

      for (const er of enrichedResults) {
        totalPorts += er.ports.length
        totalServices += er.services.filter(s => s.product).length
        resultsMap[er.ip] = {
          ports: er.ports,
          services: er.services,
          vulns: er.vulns,
          os: er.os,
          hostnames: er.hostnames,
          tags: er.tags,
          enrichment_source: er.enrichment_source,
          error: er.enrichment_source === 'none' ? 'No enrichment data available' : undefined,
        }
      }

      // Calculate exposure score (0-100)
      let score = 0
      if (uniqueIPs.length > 0) {
        const portScore = Math.min(totalPorts * 2, 40)
        const cveScore = Math.min(cveMatches.length * 5, 40)
        const ipScore = Math.min(uniqueIPs.length * 2, 20)
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

      console.log(`Scan completed: ${uniqueIPs.length} IPs, ${totalPorts} ports, ${cveMatches.length} CVEs, score=${score}`)

      return new Response(
        JSON.stringify({ success: true, snapshot_id: snapshotId, summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } catch (processError) {
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
