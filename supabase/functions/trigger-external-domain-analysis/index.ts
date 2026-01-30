import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  domain_id: string;
}

interface TriggerResponse {
  success: boolean;
  task_id?: string;
  message: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { domain_id }: TriggerRequest = await req.json();

    if (!domain_id) {
      return new Response(JSON.stringify({ success: false, error: 'domain_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[trigger-external-domain-analysis] Triggering analysis for domain: ${domain_id}`);

    const { data: domain, error: domainError } = await supabase
      .from('external_domains')
      .select('id, domain, agent_id, client_id')
      .eq('id', domain_id)
      .single();

    if (domainError || !domain) {
      console.error('[trigger-external-domain-analysis] Domain not found:', domainError);
      return new Response(JSON.stringify({ success: false, error: 'Domain not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!domain.agent_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Domínio não tem agent configurado',
          message: 'Configure um agent para este domínio antes de executar a análise.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-cleanup: mark expired tasks as timeout
    const now = new Date().toISOString();
    await supabase
      .from('agent_tasks')
      .update({
        status: 'timeout',
        error_message: 'Task expirada automaticamente pelo sistema',
        completed_at: now,
      })
      .eq('target_id', domain_id)
      .eq('target_type', 'external_domain')
      .in('status', ['pending', 'running'])
      .lt('expires_at', now);

    // Prevent duplicates (pending/running and non-expired)
    const { data: existingTask } = await supabase
      .from('agent_tasks')
      .select('id, status, expires_at')
      .eq('target_id', domain_id)
      .eq('target_type', 'external_domain')
      .in('status', ['pending', 'running'])
      .gt('expires_at', now)
      .maybeSingle();

    if (existingTask) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Já existe uma análise em andamento para este domínio',
          message: `Task ${existingTask.id} está com status: ${existingTask.status}`,
          task_id: existingTask.id,
        } satisfies TriggerResponse),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // NOTE: task_type é apenas um rótulo (enum) — os steps vêm do rpc_get_agent_tasks.
    const { data: newTask, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: domain.agent_id,
        task_type: 'external_domain_analysis',
        target_id: domain_id,
        target_type: 'external_domain',
        status: 'pending',
        priority: 5,
        expires_at: expiresAt.toISOString(),
        payload: {
          domain: domain.domain,
          client_id: domain.client_id,
        },
      })
      .select('id')
      .single();

    if (taskError || !newTask) {
      console.error('[trigger-external-domain-analysis] Failed to create task:', taskError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to create analysis task' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response: TriggerResponse = {
      success: true,
      task_id: newTask.id,
      message: 'Análise agendada com sucesso. O agent irá processar em breve.',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[trigger-external-domain-analysis] Unexpected error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
