import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskResponse {
  id: string;
  type: string;
  target: {
    id: string;
    type: string;
    url?: string;
    api_key?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    community?: string;
  };
  payload: Record<string, unknown>;
  priority: number;
  expires_at: string;
}

interface TasksSuccessResponse {
  success: true;
  tasks: TaskResponse[];
}

interface TasksErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'INTERNAL_ERROR';
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
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
        JSON.stringify({ error: 'Token de autorização ausente ou inválido', code: 'INVALID_TOKEN' } as TasksErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decode token to get the agent_id (sub claim)
    let payload: { sub?: string; exp?: number };
    try {
      const [, payloadBase64] = decode(token);
      payload = payloadBase64 as { sub?: string; exp?: number };
    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Token inválido', code: 'INVALID_TOKEN' } as TasksErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = payload.sub;
    if (!agentId) {
      console.log('Token does not contain agent ID (sub claim)');
      return new Response(
        JSON.stringify({ error: 'Token não contém identificação do agent', code: 'INVALID_TOKEN' } as TasksErrorResponse),
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
        JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as TasksErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is revoked
    if (agent.revoked) {
      console.log('Agent is blocked:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as TasksErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent has jwt_secret (is registered)
    if (!agent.jwt_secret) {
      console.log('Agent is not registered (no jwt_secret):', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as TasksErrorResponse),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as TasksErrorResponse),
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
        JSON.stringify({ error: 'Assinatura do token inválida', code: 'INVALID_SIGNATURE' } as TasksErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch pending tasks for this agent
    const { data: tasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select(`
        id,
        task_type,
        target_id,
        target_type,
        payload,
        priority,
        expires_at
      `)
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .lt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()) // Not expired
      .gt('expires_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (tasksError) {
      console.error('Failed to fetch tasks:', tasksError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar tarefas', code: 'INTERNAL_ERROR' } as TasksErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich tasks with target data (credentials, etc.)
    const enrichedTasks: TaskResponse[] = [];
    
    for (const task of tasks || []) {
      let targetData: TaskResponse['target'] = {
        id: task.target_id,
        type: task.target_type,
      };

      // Fetch target details based on type
      if (task.target_type === 'firewall') {
        const { data: firewall } = await supabase
          .from('firewalls')
          .select('id, name, fortigate_url, api_key')
          .eq('id', task.target_id)
          .single();

        if (firewall) {
          targetData = {
            id: firewall.id,
            type: 'firewall',
            url: firewall.fortigate_url,
            api_key: firewall.api_key,
          };
        }
      }
      // Add more target types as needed (switches, routers, etc.)

      // Mark task as running
      await supabase
        .from('agent_tasks')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', task.id);

      enrichedTasks.push({
        id: task.id,
        type: task.task_type,
        target: targetData,
        payload: task.payload || {},
        priority: task.priority,
        expires_at: task.expires_at,
      });
    }

    console.log(`Returning ${enrichedTasks.length} tasks for agent ${agentId}`);

    const response: TasksSuccessResponse = {
      success: true,
      tasks: enrichedTasks,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in agent-tasks:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as TasksErrorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
