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

    const { firewall_id } = await req.json();

    if (!firewall_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'firewall_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-firewall-analyzer] Starting for firewall: ${firewall_id}`);

    // Fetch firewall
    const { data: firewall, error: fwError } = await supabase
      .from('firewalls')
      .select('id, name, agent_id, device_type_id, client_id')
      .eq('id', firewall_id)
      .single();

    if (fwError || !firewall) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firewall not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!firewall.agent_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firewall sem agent configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-cleanup expired tasks and stale pending tasks (>30min without being picked up)
    const now = new Date().toISOString();
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    await supabase
      .from('agent_tasks')
      .update({ status: 'timeout', error_message: 'Task expirada', completed_at: now })
      .eq('target_id', firewall_id)
      .eq('task_type', 'fortigate_analyzer')
      .in('status', ['pending', 'running'])
      .lt('expires_at', now);

    // Cleanup pending tasks that were never picked up (stale > 30min)
    await supabase
      .from('agent_tasks')
      .update({ status: 'timeout', error_message: 'Task não foi executada pelo agent', completed_at: now })
      .eq('target_id', firewall_id)
      .eq('task_type', 'fortigate_analyzer')
      .eq('status', 'pending')
      .lt('created_at', staleThreshold);

    // Check for existing active task
    const { data: existing } = await supabase
      .from('agent_tasks')
      .select('id, status')
      .eq('target_id', firewall_id)
      .eq('task_type', 'fortigate_analyzer')
      .in('status', ['pending', 'running'])
      .gt('expires_at', now)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Análise já em andamento', task_id: existing.id, code: 'ALREADY_RUNNING' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create analyzer snapshot in pending state
    const { data: snapshot, error: snapError } = await supabase
      .from('analyzer_snapshots')
      .insert({
        firewall_id,
        client_id: firewall.client_id,
        status: 'pending',
        period_start: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        period_end: now,
      })
      .select('id')
      .single();

    if (snapError) {
      console.error('[trigger-firewall-analyzer] Failed to create snapshot:', snapError);
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
        agent_id: firewall.agent_id,
        task_type: 'fortigate_analyzer',
        target_id: firewall_id,
        target_type: 'firewall',
        status: 'pending',
        priority: 5,
        expires_at: expiresAt,
        payload: {
          firewall_name: firewall.name,
          device_type_id: firewall.device_type_id,
          snapshot_id: snapshot.id,
        },
      })
      .select('id')
      .single();

    if (taskError || !newTask) {
      console.error('[trigger-firewall-analyzer] Failed to create task:', taskError);
      // Cleanup snapshot
      await supabase.from('analyzer_snapshots').delete().eq('id', snapshot.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create task' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link task to snapshot
    await supabase
      .from('analyzer_snapshots')
      .update({ agent_task_id: newTask.id })
      .eq('id', snapshot.id);

    console.log(`[trigger-firewall-analyzer] Task ${newTask.id} created, snapshot ${snapshot.id}`);

    return new Response(
      JSON.stringify({ success: true, task_id: newTask.id, snapshot_id: snapshot.id, message: 'Análise agendada com sucesso.' }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[trigger-firewall-analyzer] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
