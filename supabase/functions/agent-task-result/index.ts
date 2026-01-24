import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskResultRequest {
  task_id: string;
  status: 'completed' | 'failed' | 'timeout';
  result?: Record<string, unknown>;
  error_message?: string;
  execution_time_ms?: number;
}

interface TaskResultSuccessResponse {
  success: true;
  task_id: string;
  status: string;
  has_more_tasks: boolean;
}

interface TaskResultErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR';
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Extract Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente ou inválido', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decode token to get the agent_id (sub claim)
    let tokenPayload: { sub?: string; exp?: number };
    try {
      const [, payloadBase64] = decode(token);
      tokenPayload = payloadBase64 as { sub?: string; exp?: number };
    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Token inválido', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = tokenPayload.sub;
    if (!agentId) {
      console.log('Token does not contain agent ID (sub claim)');
      return new Response(
        JSON.stringify({ error: 'Token não contém identificação do agent', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent data
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id, jwt_secret, revoked')
      .eq('id', agentId)
      .single();

    if (fetchError || !agent) {
      console.log('Agent not found:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is revoked
    if (agent.revoked) {
      console.log('Agent is blocked:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as TaskResultErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent has jwt_secret (is registered)
    if (!agent.jwt_secret) {
      console.log('Agent is not registered (no jwt_secret):', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as TaskResultErrorResponse),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration
    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token signature
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(agent.jwt_secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      await verify(token, cryptoKey);
    } catch (verifyError) {
      console.error('Token signature verification failed:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Assinatura do token inválida', code: 'INVALID_SIGNATURE' } as TaskResultErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: TaskResultRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.task_id || !body.status) {
      return new Response(
        JSON.stringify({ error: 'task_id e status são obrigatórios', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the task to verify ownership
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('id, agent_id, task_type, target_id, target_type, status')
      .eq('id', body.task_id)
      .single();

    if (taskError || !task) {
      console.log('Task not found:', body.task_id);
      return new Response(
        JSON.stringify({ error: 'Tarefa não encontrada', code: 'NOT_FOUND' } as TaskResultErrorResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify agent owns this task
    if (task.agent_id !== agentId) {
      console.log('Agent does not own this task:', { agentId, taskAgentId: task.agent_id });
      return new Response(
        JSON.stringify({ error: 'Tarefa não pertence a este agent', code: 'FORBIDDEN' } as TaskResultErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map status to database enum
    const dbStatus = body.status === 'completed' ? 'completed' 
                   : body.status === 'failed' ? 'failed' 
                   : body.status === 'timeout' ? 'timeout' 
                   : 'failed';

    // Update task with result
    const { error: updateError } = await supabase
      .from('agent_tasks')
      .update({
        status: dbStatus,
        result: body.result || null,
        error_message: body.error_message || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', body.task_id);

    if (updateError) {
      console.error('Failed to update task:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar tarefa', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If task completed successfully and is a compliance check, save to analysis_history
    if (body.status === 'completed' && body.result && 
        (task.task_type === 'fortigate_compliance' || task.task_type === 'fortigate_cve')) {
      
      const score = typeof body.result.score === 'number' ? body.result.score : null;
      
      if (score !== null) {
        // Save to analysis_history
        await supabase
          .from('analysis_history')
          .insert({
            firewall_id: task.target_id,
            score: score,
            report_data: body.result,
          });

        // Update firewall last_analysis_at and last_score
        await supabase
          .from('firewalls')
          .update({
            last_analysis_at: new Date().toISOString(),
            last_score: score,
          })
          .eq('id', task.target_id);
      }
    }

    console.log(`Task ${body.task_id} updated to ${dbStatus} by agent ${agentId}`);

    // Check if there are more pending tasks
    const { count } = await supabase
      .from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    const response: TaskResultSuccessResponse = {
      success: true,
      task_id: body.task_id,
      status: dbStatus,
      has_more_tasks: (count || 0) > 0,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in agent-task-result:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as TaskResultErrorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
