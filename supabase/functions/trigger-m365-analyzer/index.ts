import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_record_id } = await req.json();

    if (!tenant_record_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_record_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-m365-analyzer] Starting for tenant: ${tenant_record_id}`);

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .select('id, display_name, tenant_domain, tenant_id, client_id')
      .eq('id', tenant_record_id)
      .single();

    if (tenantError || !tenant) {
      console.error('[trigger-m365-analyzer] Tenant lookup error:', tenantError);
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch agent from m365_tenant_agents
    const { data: tenantAgent } = await supabase
      .from('m365_tenant_agents')
      .select('agent_id')
      .eq('tenant_record_id', tenant_record_id)
      .eq('enabled', true)
      .limit(1)
      .maybeSingle();

    const agentId = tenantAgent?.agent_id;

    if (!agentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant sem agent configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Auto-cleanup expired/stale tasks
    await supabase
      .from('agent_tasks')
      .update({ status: 'timeout', error_message: 'Task expirada', completed_at: now })
      .eq('target_id', tenant_record_id)
      .eq('task_type', 'm365_analyzer')
      .in('status', ['pending', 'running'])
      .lt('expires_at', now);

    await supabase
      .from('agent_tasks')
      .update({ status: 'timeout', error_message: 'Task não foi executada pelo agent', completed_at: now })
      .eq('target_id', tenant_record_id)
      .eq('task_type', 'm365_analyzer')
      .eq('status', 'pending')
      .lt('created_at', staleThreshold);

    // Check for existing active task
    const { data: existing } = await supabase
      .from('agent_tasks')
      .select('id, status')
      .eq('target_id', tenant_record_id)
      .eq('task_type', 'm365_analyzer')
      .in('status', ['pending', 'running'])
      .gt('expires_at', now)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Análise já em andamento', task_id: existing.id, code: 'ALREADY_RUNNING' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch last completed snapshot to determine period_start
    const { data: lastSnapshot } = await supabase
      .from('m365_analyzer_snapshots')
      .select('period_end')
      .eq('tenant_record_id', tenant_record_id)
      .eq('status', 'completed')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxWindowMs = 2 * 60 * 60 * 1000; // 2h cap
    let periodStart: string;
    if (lastSnapshot?.period_end) {
      const lastEnd = new Date(lastSnapshot.period_end).getTime();
      const minStart = Date.now() - maxWindowMs;
      periodStart = new Date(Math.max(lastEnd, minStart)).toISOString();
    } else {
      periodStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    }

    console.log(`[trigger-m365-analyzer] period_start=${periodStart}, period_end=${now}`);

    // Create snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('m365_analyzer_snapshots')
      .insert({
        tenant_record_id,
        client_id: tenant.client_id,
        status: 'pending',
        period_start: periodStart,
        period_end: now,
      })
      .select('id')
      .single();

    if (snapError) {
      console.error('[trigger-m365-analyzer] Failed to create snapshot:', snapError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create snapshot' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create agent task
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: newTask, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agentId,
        task_type: 'm365_analyzer',
        target_id: tenant_record_id,
        target_type: 'm365_tenant',
        status: 'pending',
        priority: 5,
        expires_at: expiresAt,
        payload: {
          tenant_display_name: tenant.display_name,
          tenant_domain: tenant.tenant_domain,
          tenant_id: tenant.tenant_id,
          snapshot_id: snapshot.id,
          period_start: periodStart,
          period_end: now,
          analysis_modules: [
            'phishing_threats',
            'mailbox_capacity',
            'behavioral_baseline',
            'account_compromise',
            'suspicious_rules',
            'exfiltration',
            'operational_risks',
          ],
        },
      })
      .select('id')
      .single();

    if (taskError || !newTask) {
      console.error('[trigger-m365-analyzer] Failed to create task:', taskError);
      await supabase.from('m365_analyzer_snapshots').delete().eq('id', snapshot.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create task' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link task to snapshot
    await supabase
      .from('m365_analyzer_snapshots')
      .update({ agent_task_id: newTask.id })
      .eq('id', snapshot.id);

    console.log(`[trigger-m365-analyzer] Task ${newTask.id} created, snapshot ${snapshot.id}`);

    return new Response(
      JSON.stringify({ success: true, task_id: newTask.id, snapshot_id: snapshot.id, message: 'Análise M365 agendada com sucesso.' }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[trigger-m365-analyzer] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
