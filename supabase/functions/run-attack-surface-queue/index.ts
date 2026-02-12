import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  if (a === 169 && b === 254) return true
  if (a === 0) return true
  if (a >= 224) return true
  return false
}

interface SourceIP {
  ip: string
  source: 'dns' | 'firewall'
  label: string
}

// ── Extract IPs from domain analyses ────────────────────────────────────────

function extractDomainIPs(reportData: any, domainName: string): SourceIP[] {
  const ips: SourceIP[] = []
  const seen = new Set<string>()
  if (!reportData) return ips

  // subdomains array
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

  // subdomain_summary (snake_case in actual data, camelCase fallback)
  const subSummary = reportData.subdomain_summary || reportData.subdomainSummary
  if (subSummary?.subdomains && Array.isArray(subSummary.subdomains)) {
    for (const sub of subSummary.subdomains) {
      if (sub.addresses && Array.isArray(sub.addresses)) {
        for (const addr of sub.addresses) {
          const ip = addr.ip || addr.value
          if (ip && !seen.has(ip) && !isPrivateIP(ip)) {
            seen.add(ip)
            ips.push({ ip, source: 'dns', label: sub.subdomain || sub.hostname || domainName })
          }
        }
      }
    }
  }

  // Deep search in checks rawData
  if (reportData.checks && Array.isArray(reportData.checks)) {
    for (const check of reportData.checks) {
      const raw = check.rawData
      if (!raw || typeof raw !== 'object') continue
      const searchObj = (obj: any, depth = 0) => {
        if (depth > 5 || !obj) return
        if (Array.isArray(obj)) { for (const item of obj) searchObj(item, depth + 1) }
        else if (typeof obj === 'object') {
          for (const key of ['ip', 'address']) {
            if (obj[key] && typeof obj[key] === 'string' && !seen.has(obj[key]) && !isPrivateIP(obj[key])) {
              seen.add(obj[key])
              ips.push({ ip: obj[key], source: 'dns', label: obj.hostname || obj.name || domainName })
            }
          }
          for (const k of Object.keys(obj)) searchObj(obj[k], depth + 1)
        }
      }
      searchObj(raw)
    }
  }

  return ips
}

// ── Extract IPs from Firewall step results ──────────────────────────────────

function extractFirewallIPs(stepResults: any[], firewallName: string): SourceIP[] {
  const ips: SourceIP[] = []
  const seen = new Set<string>()

  for (const step of stepResults) {
    if (step.step_id !== 'system_interface') continue
    const resultData = step.data
    if (!resultData) continue
    const interfaces = Array.isArray(resultData) ? resultData : (resultData.results || resultData.data || [])
    if (!Array.isArray(interfaces)) continue

    for (const iface of interfaces) {
      const ipField = iface.ip || ''
      const ipOnly = ipField.split(' ')[0].trim()
      if (!ipOnly || ipOnly === '0.0.0.0' || seen.has(ipOnly) || isPrivateIP(ipOnly)) continue
      seen.add(ipOnly)
      const ifaceName = iface.name || 'unknown'
      ips.push({ ip: ipOnly, source: 'firewall', label: `${firewallName} - ${ifaceName}` })
    }
  }
  return ips
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Read optional client_id from request body
    const body = await req.json().catch(() => ({}))
    const targetClientId = body.client_id

    let clients: any[]
    if (targetClientId) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', targetClientId)
        .single()
      if (error) throw error
      clients = [data]
    } else {
      const { data, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
      if (clientsError) throw clientsError
      clients = data || []
    }

    console.log(`[queue] Processing ${clients?.length || 0} clients`)

    let totalSnapshots = 0
    let totalTasks = 0

    for (const client of (clients || [])) {
      // Collect IPs from domain analyses
      const { data: domains } = await supabase
        .from('external_domains')
        .select('id, domain, name')
        .eq('client_id', client.id)

      const allIPs: SourceIP[] = []
      const seenIPs = new Set<string>()

      for (const domain of (domains || [])) {
        const { data: analyses } = await supabase
          .from('external_domain_analysis_history')
          .select('report_data')
          .eq('domain_id', domain.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (analyses?.[0]?.report_data) {
          const domainIPs = extractDomainIPs(analyses[0].report_data, domain.domain)
          for (const dip of domainIPs) {
            if (!seenIPs.has(dip.ip)) {
              seenIPs.add(dip.ip)
              allIPs.push(dip)
            }
          }
        }
      }

      // Collect IPs from firewall analyses (step results with system_interface)
      const { data: firewalls } = await supabase
        .from('firewalls')
        .select('id, name')
        .eq('client_id', client.id)

      for (const fw of (firewalls || [])) {
        // Get the latest completed firewall task ID
        const { data: tasks } = await supabase
          .from('agent_tasks')
          .select('id')
          .eq('target_id', fw.id)
          .eq('target_type', 'firewall')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)

        if (tasks?.[0]?.id) {
          // Read step results from the correct table
          const { data: stepResults } = await supabase
            .from('task_step_results')
            .select('step_id, data')
            .eq('task_id', tasks[0].id)
            .eq('step_id', 'system_interface')

          if (stepResults && stepResults.length > 0) {
            const fwIPs = extractFirewallIPs(stepResults, fw.name)
            for (const fip of fwIPs) {
              if (!seenIPs.has(fip.ip)) {
                seenIPs.add(fip.ip)
                allIPs.push(fip)
              }
            }
          }
        }
      }

      if (allIPs.length === 0) {
        console.log(`[queue] Client ${client.name}: no public IPs found, skipping`)
        continue
      }

      console.log(`[queue] Client ${client.name}: ${allIPs.length} unique public IPs`)

      // Create snapshot
      const { data: snapshot, error: snapError } = await supabase
        .from('attack_surface_snapshots')
        .insert({
          client_id: client.id,
          status: 'pending',
          source_ips: allIPs,
          summary: { total_ips: allIPs.length, open_ports: 0, services: 0, cves: 0 },
        })
        .select('id')
        .single()

      if (snapError) {
        console.error(`[queue] Failed to create snapshot for ${client.name}:`, snapError.message)
        continue
      }

      // Create one task per IP
      const tasks = allIPs.map(ip => ({
        snapshot_id: snapshot.id,
        ip: ip.ip,
        source: ip.source,
        label: ip.label,
        status: 'pending',
      }))

      const { error: tasksError } = await supabase
        .from('attack_surface_tasks')
        .insert(tasks)

      if (tasksError) {
        console.error(`[queue] Failed to create tasks for ${client.name}:`, tasksError.message)
        continue
      }

      totalSnapshots++
      totalTasks += tasks.length
      console.log(`[queue] Client ${client.name}: snapshot ${snapshot.id}, ${tasks.length} tasks created`)
    }

    // Check if any super agents are online (last_seen within 5 minutes)
    const { data: superAgents } = await supabase
      .from('agents')
      .select('id, name, last_seen')
      .eq('is_system_agent', true)
      .eq('revoked', false)

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const onlineAgents = (superAgents || []).filter(a => a.last_seen && a.last_seen > fiveMinAgo)

    if (totalTasks > 0 && onlineAgents.length === 0) {
      // Create alert
      await supabase.from('system_alerts').insert({
        alert_type: 'no_super_agent_online',
        severity: 'critical',
        title: 'Nenhum Super Agent online',
        message: `${totalTasks} tasks de Attack Surface foram criadas, mas nenhum Super Agent está online para processá-las. Inicie ou adicione um Super Agent.`,
        metadata: { total_tasks: totalTasks, total_snapshots: totalSnapshots },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    return new Response(JSON.stringify({
      success: true,
      snapshots_created: totalSnapshots,
      tasks_created: totalTasks,
      super_agents_online: onlineAgents.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[queue] Error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
