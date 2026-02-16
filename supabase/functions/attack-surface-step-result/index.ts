import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { task_id, status, result } = body

    if (!task_id) {
      return new Response(JSON.stringify({ error: 'task_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[step-result] Task ${task_id}: status=${status}`)

    // Update the task
    const updateData: Record<string, any> = {
      status: status === 'success' ? 'completed' : (status === 'failed' ? 'failed' : status),
      completed_at: new Date().toISOString(),
    }

    if (result) {
      // Merge masscan + nmap + httpx results into a single result object
      updateData.result = result
    }

    const { data: task, error: updateError } = await supabase
      .from('attack_surface_tasks')
      .update(updateData)
      .eq('id', task_id)
      .select('snapshot_id, ip')
      .single()

    if (updateError) {
      console.error(`[step-result] Failed to update task ${task_id}:`, updateError.message)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if all tasks for this snapshot are done
    const snapshotId = task.snapshot_id

    const { data: pendingTasks } = await supabase
      .from('attack_surface_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('snapshot_id', snapshotId)
      .in('status', ['pending', 'assigned', 'running'])

    const pendingCount = pendingTasks?.length ?? 0

    if (pendingCount === 0) {
      console.log(`[step-result] All tasks for snapshot ${snapshotId} completed. Consolidating...`)

      // Fetch all completed tasks
      const { data: allTasks } = await supabase
        .from('attack_surface_tasks')
        .select('ip, source, label, status, result')
        .eq('snapshot_id', snapshotId)

      // Fetch existing results from snapshot to merge
      const { data: existingSnapshot } = await supabase
        .from('attack_surface_snapshots')
        .select('results')
        .eq('id', snapshotId)
        .single()

      const existingResults: Record<string, any> = (existingSnapshot?.results as Record<string, any>) || {}

      // Consolidate: start with existing results, then overlay task results
      const results: Record<string, any> = { ...existingResults }
      let totalPorts = 0
      let totalServices = 0
      const allVulns = new Set<string>()

      // Update only IPs that had tasks in this batch
      for (const t of (allTasks || [])) {
        const r = t.result || {}
        results[t.ip] = {
          ports: r.ports || [],
          services: r.services || [],
          web_services: r.web_services || [],
          vulns: r.vulns || [],
          os: r.os || '',
          hostnames: r.hostnames || [],
          asn: r.raw_steps?.asn_classifier?.data || null,
          error: t.status === 'failed' ? (r.error || 'Task failed') : undefined,
        }
      }

      // Recalculate summary from ALL IPs (existing + updated)
      for (const ip of Object.keys(results)) {
        const r = results[ip]
        totalPorts += (r.ports || []).length
        totalServices += (r.services || []).length + (r.web_services || []).length
        for (const v of (r.vulns || [])) allVulns.add(v)
      }

      // Calculate exposure score (0-100, lower is better)
      const totalIPs = Object.keys(results).length
      const vulnCount = allVulns.size
      // Score formula: weighted combination of open ports, services, vulns
      let score = 100
      if (totalIPs > 0) {
        const avgPorts = totalPorts / totalIPs
        const portPenalty = Math.min(avgPorts * 2, 40) // max 40 points from ports
        const servicePenalty = Math.min(totalServices * 1.5, 30) // max 30 from services  
        const vulnPenalty = Math.min(vulnCount * 5, 30) // max 30 from vulns
        score = Math.max(0, Math.round(100 - portPenalty - servicePenalty - vulnPenalty))
      }

      // Match CVEs from cve_cache based on CPEs found
      const allCPEs: string[] = []
      for (const ip of Object.keys(results)) {
        for (const svc of (results[ip].services || [])) {
          if (svc.cpe && Array.isArray(svc.cpe)) {
            allCPEs.push(...svc.cpe)
          }
        }
      }

      let cveMatches: any[] = []
      if (allCPEs.length > 0) {
        // Search CVE cache for matching products
        const products = allCPEs.map((cpe: string) => {
          const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':')
          return (parts[2] || '').replace(/_/g, ' ')
        }).filter(Boolean)

        if (products.length > 0) {
          const uniqueProducts = [...new Set(products)]
          // Simple ILIKE search for each product
          for (const product of uniqueProducts.slice(0, 10)) {
            const { data: cves } = await supabase
              .from('cve_cache')
              .select('cve_id, title, severity, score, advisory_url, products')
              .ilike('title', `%${product}%`)
              .order('score', { ascending: false })
              .limit(5)

            if (cves) {
              for (const cve of cves) {
                if (!cveMatches.find(c => c.cve_id === cve.cve_id)) {
                  cveMatches.push(cve)
                }
              }
            }
          }
        }
      }

      // Update snapshot
      await supabase
        .from('attack_surface_snapshots')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          results,
          cve_matches: cveMatches,
          summary: {
            total_ips: totalIPs,
            open_ports: totalPorts,
            services: totalServices,
            cves: vulnCount + cveMatches.length,
          },
          score,
        })
        .eq('id', snapshotId)

      console.log(`[step-result] Snapshot ${snapshotId} completed: score=${score}, ips=${totalIPs}, ports=${totalPorts}`)
    } else {
      // Update snapshot status to running if still pending
      await supabase
        .from('attack_surface_snapshots')
        .update({ status: 'running' })
        .eq('id', snapshotId)
        .eq('status', 'pending')
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[step-result] Error:', (error as Error).message)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
