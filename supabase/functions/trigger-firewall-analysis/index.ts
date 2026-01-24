import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  firewall_id: string;
}

interface TriggerResponse {
  success: boolean;
  task_id?: string;
  message: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Get request body
    const { firewall_id }: TriggerRequest = await req.json();

    if (!firewall_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'firewall_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-firewall-analysis] Triggering analysis for firewall: ${firewall_id}`);

    // Fetch firewall details
    const { data: firewall, error: fwError } = await supabase
      .from('firewalls')
      .select('id, name, agent_id, device_type_id, client_id')
      .eq('id', firewall_id)
      .single();

    if (fwError || !firewall) {
      console.error('[trigger-firewall-analysis] Firewall not found:', fwError);
      return new Response(
        JSON.stringify({ success: false, error: 'Firewall not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-firewall-analysis] Firewall found:`, firewall);

    // Validate agent and device_type are configured
    if (!firewall.agent_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Firewall não tem agent configurado',
          message: 'Configure um agent para este firewall antes de executar a análise.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!firewall.device_type_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Firewall não tem tipo de dispositivo configurado',
          message: 'Configure o tipo de dispositivo para este firewall.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-cleanup: Mark expired tasks as timeout before checking for duplicates
    const now = new Date().toISOString();
    const { data: expiredTasks } = await supabase
      .from('agent_tasks')
      .update({
        status: 'timeout',
        error_message: 'Task expirada automaticamente pelo sistema',
        completed_at: now
      })
      .eq('target_id', firewall_id)
      .eq('target_type', 'firewall')
      .in('status', ['pending', 'running'])
      .lt('expires_at', now)
      .select('id');

    if (expiredTasks?.length) {
      console.log(`[trigger-firewall-analysis] Auto-cleaned ${expiredTasks.length} expired tasks`);
    }

    // Check if there's already a pending/running task for this firewall (only non-expired)
    const { data: existingTask } = await supabase
      .from('agent_tasks')
      .select('id, status, expires_at')
      .eq('target_id', firewall_id)
      .eq('target_type', 'firewall')
      .in('status', ['pending', 'running'])
      .gt('expires_at', now)
      .maybeSingle();

    if (existingTask) {
      console.log(`[trigger-firewall-analysis] Task already exists: ${existingTask.id} (${existingTask.status})`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Já existe uma análise em andamento para este firewall',
          message: `Task ${existingTask.id} está com status: ${existingTask.status}`,
          task_id: existingTask.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new task
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: newTask, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: firewall.agent_id,
        task_type: 'fortigate_compliance',
        target_id: firewall_id,
        target_type: 'firewall',
        status: 'pending',
        priority: 5,
        expires_at: expiresAt.toISOString(),
        payload: {
          firewall_name: firewall.name,
          device_type_id: firewall.device_type_id
        }
      })
      .select('id')
      .single();

    if (taskError || !newTask) {
      console.error('[trigger-firewall-analysis] Failed to create task:', taskError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create analysis task' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-firewall-analysis] Task created successfully: ${newTask.id}`);

    const response: TriggerResponse = {
      success: true,
      task_id: newTask.id,
      message: 'Análise agendada com sucesso. O agent irá processar em breve.'
    };

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[trigger-firewall-analysis] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
