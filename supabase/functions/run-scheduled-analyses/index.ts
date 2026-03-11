import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders } from '../_shared/cors.ts';

const AGENT_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Deterministic stagger offset based on schedule ID.
 * Returns 0-14 minutes to stay within the 15-minute cron window.
 * This prevents schedules from falling between cron cycles.
 */
function getStaggerOffsetMinutes(scheduleId: string): number {
  let hash = 0;
  for (let i = 0; i < scheduleId.length; i++) {
    hash = ((hash << 5) - hash) + scheduleId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 15;
}

function calculateNextRunAt(
  frequency: string,
  hour: number, // stored as BRT (UTC-3)
  dayOfWeek: number,
  dayOfMonth: number,
  scheduleId: string
): string {
  const now = new Date();
  const offset = getStaggerOffsetMinutes(scheduleId);
  // Convert BRT hour to UTC
  const utcHour = (hour + 3) % 24;
  const dayOffset = (hour + 3) >= 24 ? 1 : 0;
  let next: Date;

  if (frequency === 'hourly') {
    next = new Date(now);
    next.setUTCMinutes(offset, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
  } else if (frequency === 'daily') {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, utcHour, offset, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'weekly') {
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, utcHour, offset, 0));
    const currentDay = next.getUTCDay();
    let daysAhead = dayOfWeek - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    next.setUTCDate(next.getUTCDate() + daysAhead);
  } else {
    // monthly
    next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth + dayOffset, utcHour, offset, 0));
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next.toISOString();
}

/**
 * Check if an agent is online (last_seen within threshold).
 */
async function isAgentOnline(supabase: ReturnType<typeof createClient>, agentId: string | null): Promise<{ online: boolean; agentName?: string; lastSeen?: string }> {
  if (!agentId) return { online: false, agentName: 'N/A', lastSeen: 'never' };
  
  const { data: agent } = await supabase
    .from('agents')
    .select('name, last_seen')
    .eq('id', agentId)
    .single();
  
  if (!agent) return { online: false, agentName: 'unknown', lastSeen: 'never' };
  
  const lastSeen = agent.last_seen ? new Date(agent.last_seen).getTime() : 0;
  const online = (Date.now() - lastSeen) <= AGENT_OFFLINE_THRESHOLD_MS;
  
  return { online, agentName: agent.name, lastSeen: agent.last_seen || 'never' };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth: rely on Supabase infrastructure (anon/service key in header)
    // The cron job sends Authorization header; internal ops use service role client

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[run-scheduled-analyses] Starting scheduled analysis check...');

    // Cleanup stuck/timed-out tasks before dispatching new ones
    const { error: cleanupError } = await supabase.rpc('cleanup_stuck_tasks');
    if (cleanupError) {
      console.error('[run-scheduled-analyses] cleanup_stuck_tasks error:', cleanupError);
    }

    // ========================================================
    // Firewall Compliance Schedules
    // ========================================================
    const { data: dueSchedules, error: fetchError } = await supabase
      .from('analysis_schedules')
      .select('id, firewall_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (fetchError) {
      console.error('[run-scheduled-analyses] Error fetching schedules:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('[run-scheduled-analyses] No firewall schedules due.');
    }

    console.log(`[run-scheduled-analyses] Found ${dueSchedules.length} schedule(s) due for execution.`);

    let triggered = 0;
    let errors = 0;
    let skippedOffline = 0;

    for (const schedule of (dueSchedules || [])) {
      try {
        // Always calculate next_run_at first
        const nextRunAt = calculateNextRunAt(
          schedule.frequency,
          schedule.scheduled_hour ?? 0,
          schedule.scheduled_day_of_week ?? 1,
          schedule.scheduled_day_of_month ?? 1,
          schedule.id
        );

        // If next_run_at was NULL, just recalculate without triggering
        if (!schedule.next_run_at) {
          await supabase.from('analysis_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
          console.log(`[run-scheduled-analyses] Recalculated next_run_at for schedule ${schedule.id}: ${nextRunAt}`);
          continue;
        }

        // Pre-check: resolve agent and check online status
        const { data: fw } = await supabase.from('firewalls').select('agent_id, name').eq('id', schedule.firewall_id).single();
        const agentStatus = await isAgentOnline(supabase, fw?.agent_id || null);
        
        if (!agentStatus.online) {
          console.log(`[run-scheduled-analyses] Skipping firewall ${fw?.name || schedule.firewall_id}: agent ${agentStatus.agentName} offline (last_seen: ${agentStatus.lastSeen})`);
          skippedOffline++;
        } else {
          // Call trigger-firewall-analysis
          const triggerUrl = `${supabaseUrl}/functions/v1/trigger-firewall-analysis`;
          const response = await fetch(triggerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ firewall_id: schedule.firewall_id }),
          });

          const result = await response.json();

          if (result.success || response.status === 409 || result.code === 'ALREADY_RUNNING') {
            console.log(`[run-scheduled-analyses] Triggered firewall ${schedule.firewall_id}: ${result.message || 'success'}`);
            triggered++;
          } else {
            console.error(`[run-scheduled-analyses] Failed to trigger firewall ${schedule.firewall_id}:`, result.error);
            errors++;
          }
        }

        // Update next_run_at
        await supabase.from('analysis_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
        console.log(`[run-scheduled-analyses] Updated next_run_at for schedule ${schedule.id}: ${nextRunAt}`);
      } catch (err) {
        console.error(`[run-scheduled-analyses] Error processing schedule ${schedule.id}:`, err);
        errors++;
      }
    }

    console.log(`[run-scheduled-analyses] Firewalls done. Triggered: ${triggered}, Skipped (offline): ${skippedOffline}, Errors: ${errors}`);

    // ========================================================
    // External Domain Schedules
    // ========================================================
    const { data: dueDomainSchedules, error: domainFetchError } = await supabase
      .from('external_domain_schedules')
      .select('id, domain_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (domainFetchError) {
      console.error('[run-scheduled-analyses] Error fetching domain schedules:', domainFetchError);
    }

    let domainTriggered = 0;
    let domainErrors = 0;
    let domainSkipped = 0;

    if (dueDomainSchedules && dueDomainSchedules.length > 0) {
      console.log(`[run-scheduled-analyses] Found ${dueDomainSchedules.length} external domain schedule(s) due.`);

      for (const schedule of dueDomainSchedules) {
        try {
          const nextRunAt = calculateNextRunAt(
            schedule.frequency, schedule.scheduled_hour ?? 0,
            schedule.scheduled_day_of_week ?? 1, schedule.scheduled_day_of_month ?? 1,
            schedule.id
          );

          if (!schedule.next_run_at) {
            await supabase.from('external_domain_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
            console.log(`[run-scheduled-analyses] Recalculated next_run_at for domain schedule ${schedule.id}: ${nextRunAt}`);
            continue;
          }

          // Pre-check agent online
          const { data: dom } = await supabase.from('external_domains').select('agent_id, domain').eq('id', schedule.domain_id).single();
          const agentStatus = await isAgentOnline(supabase, dom?.agent_id || null);

          if (!agentStatus.online) {
            console.log(`[run-scheduled-analyses] Skipping domain ${dom?.domain || schedule.domain_id}: agent ${agentStatus.agentName} offline (last_seen: ${agentStatus.lastSeen})`);
            domainSkipped++;
          } else {
            const triggerUrl = `${supabaseUrl}/functions/v1/trigger-external-domain-analysis`;
            const response = await fetch(triggerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ domain_id: schedule.domain_id }),
            });
            const result = await response.json();
            if (result.success || response.status === 409 || result.code === 'ALREADY_RUNNING') {
              console.log(`[run-scheduled-analyses] Triggered domain ${schedule.domain_id}: ${result.message || 'success'}`);
              domainTriggered++;
            } else {
              console.error(`[run-scheduled-analyses] Failed to trigger domain ${schedule.domain_id}:`, result.error);
              domainErrors++;
            }
          }

          await supabase.from('external_domain_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
          console.log(`[run-scheduled-analyses] Updated next_run_at for domain schedule ${schedule.id}: ${nextRunAt}`);
        } catch (err) {
          console.error(`[run-scheduled-analyses] Error processing domain schedule ${schedule.id}:`, err);
          domainErrors++;
        }
      }
    } else {
      console.log('[run-scheduled-analyses] No external domain schedules due.');
    }

    // ========================================================
    // Analyzer Schedules
    // ========================================================
    const { data: dueAnalyzerSchedules, error: analyzerFetchError } = await supabase
      .from('analyzer_schedules')
      .select('id, firewall_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (analyzerFetchError) {
      console.error('[run-scheduled-analyses] Error fetching analyzer schedules:', analyzerFetchError);
    }

    let analyzerTriggered = 0;
    let analyzerErrors = 0;
    let analyzerSkipped = 0;

    if (dueAnalyzerSchedules && dueAnalyzerSchedules.length > 0) {
      console.log(`[run-scheduled-analyses] Found ${dueAnalyzerSchedules.length} analyzer schedule(s) due.`);

      for (const schedule of dueAnalyzerSchedules) {
        try {
          const nextRunAt = calculateNextRunAt(
            schedule.frequency, schedule.scheduled_hour ?? 0,
            schedule.scheduled_day_of_week ?? 1, schedule.scheduled_day_of_month ?? 1,
            schedule.id
          );

          if (!schedule.next_run_at) {
            await supabase.from('analyzer_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
            console.log(`[run-scheduled-analyses] Recalculated next_run_at for analyzer schedule ${schedule.id}: ${nextRunAt}`);
            continue;
          }

          const { data: fw } = await supabase.from('firewalls').select('agent_id, name').eq('id', schedule.firewall_id).single();
          const agentStatus = await isAgentOnline(supabase, fw?.agent_id || null);

          if (!agentStatus.online) {
            console.log(`[run-scheduled-analyses] Skipping analyzer for ${fw?.name || schedule.firewall_id}: agent ${agentStatus.agentName} offline`);
            analyzerSkipped++;
          } else {
            const triggerUrl = `${supabaseUrl}/functions/v1/trigger-firewall-analyzer`;
            const response = await fetch(triggerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ firewall_id: schedule.firewall_id }),
            });
            const result = await response.json();
            if (result.success || response.status === 409 || result.code === 'ALREADY_RUNNING') { analyzerTriggered++; }
            else { analyzerErrors++; }
          }

          await supabase.from('analyzer_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
        } catch (err) {
          console.error(`[run-scheduled-analyses] Analyzer schedule error:`, err);
          analyzerErrors++;
        }
      }
    }

    // ========================================================
    // Attack Surface Schedules (no agent check — uses system agents)
    // ========================================================
    const { data: dueAttackSurfaceSchedules, error: attackSurfaceFetchError } = await supabase
      .from('attack_surface_schedules')
      .select('id, client_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (attackSurfaceFetchError) {
      console.error('[run-scheduled-analyses] Error fetching attack surface schedules:', attackSurfaceFetchError);
    }

    let attackSurfaceTriggered = 0;
    let attackSurfaceErrors = 0;

    if (dueAttackSurfaceSchedules && dueAttackSurfaceSchedules.length > 0) {
      console.log(`[run-scheduled-analyses] Found ${dueAttackSurfaceSchedules.length} attack surface schedule(s) due.`);

      for (const schedule of dueAttackSurfaceSchedules) {
        try {
          const nextRunAt = calculateNextRunAt(
            schedule.frequency, schedule.scheduled_hour ?? 0,
            schedule.scheduled_day_of_week ?? 1, schedule.scheduled_day_of_month ?? 1,
            schedule.id
          );

          if (!schedule.next_run_at) {
            await supabase.from('attack_surface_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
            console.log(`[run-scheduled-analyses] Recalculated next_run_at for attack surface schedule ${schedule.id}: ${nextRunAt}`);
            continue;
          }

          const triggerUrl = `${supabaseUrl}/functions/v1/run-attack-surface-queue`;
          const response = await fetch(triggerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ client_id: schedule.client_id }),
          });
          const result = await response.json();
          if (result.success || response.status === 409) {
            console.log(`[run-scheduled-analyses] Triggered attack surface for client ${schedule.client_id}: ${result.message || 'success'}`);
            attackSurfaceTriggered++;
          } else {
            console.error(`[run-scheduled-analyses] Failed to trigger attack surface for client ${schedule.client_id}:`, result.error);
            attackSurfaceErrors++;
          }

          await supabase.from('attack_surface_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
          console.log(`[run-scheduled-analyses] Updated next_run_at for attack surface schedule ${schedule.id}: ${nextRunAt}`);
        } catch (err) {
          console.error(`[run-scheduled-analyses] Attack surface schedule error:`, err);
          attackSurfaceErrors++;
        }
      }
    } else {
      console.log('[run-scheduled-analyses] No attack surface schedules due.');
    }

    // ========================================================
    // M365 Analyzer Schedules
    // ========================================================
    const { data: dueM365AnalyzerSchedules, error: m365AnalyzerFetchError } = await supabase
      .from('m365_analyzer_schedules')
      .select('id, tenant_record_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (m365AnalyzerFetchError) {
      console.error('[run-scheduled-analyses] Error fetching M365 analyzer schedules:', m365AnalyzerFetchError);
    }

    let m365AnalyzerTriggered = 0;
    let m365AnalyzerErrors = 0;
    let m365AnalyzerSkipped = 0;

    if (dueM365AnalyzerSchedules && dueM365AnalyzerSchedules.length > 0) {
      console.log(`[run-scheduled-analyses] Found ${dueM365AnalyzerSchedules.length} M365 analyzer schedule(s) due.`);

      for (const schedule of dueM365AnalyzerSchedules) {
        try {
          const nextRunAt = calculateNextRunAt(
            schedule.frequency, schedule.scheduled_hour ?? 0,
            schedule.scheduled_day_of_week ?? 1, schedule.scheduled_day_of_month ?? 1,
            schedule.id
          );

          if (!schedule.next_run_at) {
            await supabase.from('m365_analyzer_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
            console.log(`[run-scheduled-analyses] Recalculated next_run_at for M365 analyzer schedule ${schedule.id}: ${nextRunAt}`);
            continue;
          }

          const { data: tenantAgent } = await supabase
            .from('m365_tenant_agents')
            .select('agent_id')
            .eq('tenant_record_id', schedule.tenant_record_id)
            .eq('enabled', true)
            .limit(1)
            .maybeSingle();

          const agentStatus = await isAgentOnline(supabase, tenantAgent?.agent_id || null);

          if (!agentStatus.online) {
            console.log(`[run-scheduled-analyses] Skipping M365 tenant ${schedule.tenant_record_id}: agent ${agentStatus.agentName} offline`);
            m365AnalyzerSkipped++;
          } else {
            const triggerUrl = `${supabaseUrl}/functions/v1/trigger-m365-analyzer`;
            const response = await fetch(triggerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
            });
            const result = await response.json();
            if (result.success || response.status === 409 || result.code === 'ALREADY_RUNNING') {
              console.log(`[run-scheduled-analyses] Triggered M365 analyzer for tenant ${schedule.tenant_record_id}`);
              m365AnalyzerTriggered++;

              try {
                const exchangeUrl = `${supabaseUrl}/functions/v1/exchange-dashboard`;
                const exchResp = await fetch(exchangeUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                  body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
                });
                const exchResult = await exchResp.json();
                if (!exchResult.success) {
                  const retryResp = await fetch(exchangeUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                    body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
                  });
                  await retryResp.json();
                }
              } catch (e) {
                console.error(`[run-scheduled-analyses] exchange-dashboard error:`, e);
              }
            } else {
              console.error(`[run-scheduled-analyses] Failed to trigger M365 analyzer for tenant ${schedule.tenant_record_id}:`, result.error);
              m365AnalyzerErrors++;
            }
          }

          await supabase.from('m365_analyzer_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
        } catch (err) {
          console.error(`[run-scheduled-analyses] M365 analyzer schedule error:`, err);
          m365AnalyzerErrors++;
        }
      }
    } else {
      console.log('[run-scheduled-analyses] No M365 analyzer schedules due.');
    }

    // ========================================================
    // M365 Compliance Schedules (Posture Analysis)
    // ========================================================
    const { data: dueM365ComplianceSchedules, error: m365ComplianceFetchError } = await supabase
      .from('m365_compliance_schedules')
      .select('id, tenant_record_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, next_run_at')
      .eq('is_active', true)
      .not('frequency', 'eq', 'manual')
      .or(`next_run_at.lte.${new Date().toISOString()},next_run_at.is.null`);

    if (m365ComplianceFetchError) {
      console.error('[run-scheduled-analyses] Error fetching M365 compliance schedules:', m365ComplianceFetchError);
    }

    let m365ComplianceTriggered = 0;
    let m365ComplianceErrors = 0;
    let m365ComplianceSkipped = 0;

    if (dueM365ComplianceSchedules && dueM365ComplianceSchedules.length > 0) {
      console.log(`[run-scheduled-analyses] Found ${dueM365ComplianceSchedules.length} M365 compliance schedule(s) due.`);

      for (const schedule of dueM365ComplianceSchedules) {
        try {
          const nextRunAt = calculateNextRunAt(
            schedule.frequency, schedule.scheduled_hour ?? 0,
            schedule.scheduled_day_of_week ?? 1, schedule.scheduled_day_of_month ?? 1,
            schedule.id
          );

          if (!schedule.next_run_at) {
            await supabase.from('m365_compliance_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
            console.log(`[run-scheduled-analyses] Recalculated next_run_at for M365 compliance schedule ${schedule.id}: ${nextRunAt}`);
            continue;
          }

          const { data: tenantAgent } = await supabase
            .from('m365_tenant_agents')
            .select('agent_id')
            .eq('tenant_record_id', schedule.tenant_record_id)
            .eq('enabled', true)
            .limit(1)
            .maybeSingle();

          const agentStatus = await isAgentOnline(supabase, tenantAgent?.agent_id || null);

          if (!agentStatus.online) {
            console.log(`[run-scheduled-analyses] Skipping M365 compliance ${schedule.tenant_record_id}: agent offline`);
            m365ComplianceSkipped++;
          } else {
            const triggerUrl = `${supabaseUrl}/functions/v1/trigger-m365-posture-analysis`;
            const response = await fetch(triggerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ tenant_record_id: schedule.tenant_record_id }),
            });
            const result = await response.json();
            if (result.success || response.status === 409) {
              console.log(`[run-scheduled-analyses] Triggered M365 compliance for tenant ${schedule.tenant_record_id}`);
              m365ComplianceTriggered++;
            } else {
              console.error(`[run-scheduled-analyses] Failed to trigger M365 compliance for tenant ${schedule.tenant_record_id}:`, result.error);
              m365ComplianceErrors++;
            }
          }

          await supabase.from('m365_compliance_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
        } catch (err) {
          console.error(`[run-scheduled-analyses] M365 compliance schedule error:`, err);
          m365ComplianceErrors++;
        }
      }
    } else {
      console.log('[run-scheduled-analyses] No M365 compliance schedules due.');
    }

    // ========================================================
    // CVE Cache Refresh
    // ========================================================
    let cveRefreshSuccess = false;
    try {
      console.log('[run-scheduled-analyses] Triggering CVE cache refresh...');
      const cveRefreshUrl = `${supabaseUrl}/functions/v1/refresh-cve-cache`;
      const cveRes = await fetch(cveRefreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({}),
      });
      const cveResult = await cveRes.json();
      cveRefreshSuccess = !!cveResult.success;
      console.log(`[run-scheduled-analyses] CVE refresh: ${cveRefreshSuccess ? 'success' : 'failed'}`);
    } catch (err) {
      console.error('[run-scheduled-analyses] CVE refresh error:', err);
    }

    const totalTriggered = triggered + domainTriggered + analyzerTriggered + attackSurfaceTriggered + m365AnalyzerTriggered + m365ComplianceTriggered;
    const totalErrors = errors + domainErrors + analyzerErrors + attackSurfaceErrors + m365AnalyzerErrors + m365ComplianceErrors;
    const totalSkipped = skippedOffline + domainSkipped + analyzerSkipped + m365AnalyzerSkipped + m365ComplianceSkipped;

    console.log(`[run-scheduled-analyses] Done. Triggered: ${totalTriggered}, Skipped (offline): ${totalSkipped}, Errors: ${totalErrors}`);
    console.log(`[run-scheduled-analyses] Breakdown — Firewalls: ${triggered}/${skippedOffline}skip, Domains: ${domainTriggered}/${domainSkipped}skip, Analyzers: ${analyzerTriggered}/${analyzerSkipped}skip, AttackSurface: ${attackSurfaceTriggered}, M365Analyzer: ${m365AnalyzerTriggered}/${m365AnalyzerSkipped}skip, M365Compliance: ${m365ComplianceTriggered}/${m365ComplianceSkipped}skip, CVE: ${cveRefreshSuccess}`);

    return new Response(
      JSON.stringify({
        success: true,
        triggered: totalTriggered,
        skipped_offline: totalSkipped,
        errors: totalErrors,
        firewalls: { triggered, skipped: skippedOffline, errors, total: dueSchedules.length },
        domains: { triggered: domainTriggered, skipped: domainSkipped, errors: domainErrors, total: dueDomainSchedules?.length ?? 0 },
        analyzers: { triggered: analyzerTriggered, skipped: analyzerSkipped, errors: analyzerErrors, total: dueAnalyzerSchedules?.length ?? 0 },
        attack_surface: { triggered: attackSurfaceTriggered, errors: attackSurfaceErrors, total: dueAttackSurfaceSchedules?.length ?? 0 },
        m365_analyzer: { triggered: m365AnalyzerTriggered, skipped: m365AnalyzerSkipped, errors: m365AnalyzerErrors, total: dueM365AnalyzerSchedules?.length ?? 0 },
        m365_compliance: { triggered: m365ComplianceTriggered, skipped: m365ComplianceSkipped, errors: m365ComplianceErrors, total: dueM365ComplianceSchedules?.length ?? 0 },
        cve_refresh: cveRefreshSuccess,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[run-scheduled-analyses] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
