import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Types
// ============================================

interface StepConfig {
  id: string;
  executor: string;
  config: Record<string, unknown>;
}

interface TaskResponse {
  id: string;
  type: string;
  target: {
    id: string;
    type: string;
    base_url?: string;
    domain?: string;
    tenant_id?: string;
    tenant_domain?: string;
    credentials?: {
      api_key?: string;
      username?: string;
      password?: string;
      community?: string;
      azure_app_id?: string;
      certificate_thumbprint?: string;
    };
    host?: string;
    port?: number;
  };
  steps: StepConfig[];
  payload?: Record<string, unknown>;
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

interface RpcTaskData {
  id: string;
  task_type: string;
  target_id: string;
  target_type: string;
  payload: Record<string, unknown>;
  priority: number;
  expires_at: string;
  target: {
    id: string;
    type: string;
    base_url: string;
    domain?: string;
    tenant_id?: string;
    tenant_domain?: string;
    credentials: {
      api_key: string;
      username: string | null;
      password: string | null;
      azure_app_id?: string;
      certificate_thumbprint?: string;
    };
  };
  blueprint: {
    steps: StepConfig[];
  };
}

// ============================================
// Main Handler
// ============================================

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

    // Check token expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as TasksErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch agent data for JWT validation
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

    // Call optimized RPC that fetches tasks with JOINs and marks them as running in a single transaction
    const { data: tasksData, error: rpcError } = await supabase
      .rpc('rpc_get_agent_tasks', { p_agent_id: agentId, p_limit: 10 });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar tarefas', code: 'INTERNAL_ERROR' } as TasksErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform RPC result to TaskResponse format
    const tasks = (tasksData as RpcTaskData[] || []);
    const enrichedTasks: TaskResponse[] = tasks.map(task => ({
      id: task.id,
      type: task.task_type === 'fortigate_compliance' ? 'data_collection' : task.task_type,
      target: {
        id: task.target?.id || task.target_id,
        type: task.target?.type || task.target_type,
        base_url: task.target?.base_url,
        domain: task.target?.domain,
        tenant_id: task.target?.tenant_id,
        tenant_domain: task.target?.tenant_domain,
        credentials: task.target?.credentials ? {
          api_key: task.target.credentials.api_key || undefined,
          username: task.target.credentials.username || undefined,
          password: task.target.credentials.password || undefined,
          azure_app_id: task.target.credentials.azure_app_id || undefined,
          certificate_thumbprint: task.target.credentials.certificate_thumbprint || undefined,
        } : undefined,
      },
      steps: task.blueprint?.steps || [],
      payload: task.payload || undefined,
      priority: task.priority,
      expires_at: task.expires_at,
    }));

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
