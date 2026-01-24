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
    credentials?: {
      api_key?: string;
      username?: string;
      password?: string;
      community?: string;
    };
    host?: string;
    port?: number;
  };
  steps: StepConfig[];
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

// ============================================
// Helper Functions
// ============================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

async function getDeviceBlueprint(
  supabase: SupabaseClient,
  deviceTypeId: string | null,
  _taskType: string
): Promise<StepConfig[]> {
  // If no device_type_id, return empty steps (legacy behavior)
  if (!deviceTypeId) {
    console.log('No device_type_id, returning empty steps for legacy task');
    return [];
  }

  // Fetch the active blueprint for this device type
  const { data: blueprint, error } = await supabase
    .from('device_blueprints')
    .select('collection_steps')
    .eq('device_type_id', deviceTypeId)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !blueprint) {
    console.log('No blueprint found for device type:', deviceTypeId);
    return [];
  }

  // Extract steps from the blueprint
  const blueprintData = blueprint as { collection_steps: { steps?: StepConfig[] } };
  return blueprintData.collection_steps?.steps || [];
}

async function getTargetCredentials(
  supabase: SupabaseClient,
  targetId: string,
  targetType: string
): Promise<TaskResponse['target'] | null> {
  if (targetType === 'firewall') {
    const { data: firewall, error } = await supabase
      .from('firewalls')
      .select('id, name, fortigate_url, api_key, device_type_id')
      .eq('id', targetId)
      .single();

    if (error || !firewall) {
      console.log('Firewall not found:', targetId);
      return null;
    }

    const fw = firewall as { id: string; name: string; fortigate_url: string; api_key: string; device_type_id: string | null };

    return {
      id: fw.id,
      type: 'firewall',
      base_url: fw.fortigate_url,
      credentials: {
        api_key: fw.api_key,
      },
    };
  }

  // Add more target types here (switches, routers, etc.)
  return {
    id: targetId,
    type: targetType,
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
      .lt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
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

    // Enrich tasks with target data and blueprint steps
    const enrichedTasks: TaskResponse[] = [];
    
    for (const task of tasks || []) {
      // Get target credentials
      const targetData = await getTargetCredentials(supabase, task.target_id, task.target_type);
      
      if (!targetData) {
        console.log('Skipping task - target not found:', task.target_id);
        continue;
      }

      // Get device_type_id from the target (firewall)
      let deviceTypeId: string | null = null;
      if (task.target_type === 'firewall') {
        const { data: firewall } = await supabase
          .from('firewalls')
          .select('device_type_id')
          .eq('id', task.target_id)
          .single();
        
        deviceTypeId = firewall?.device_type_id || null;
        
        // If no device_type_id set, try to use default FortiGate
        if (!deviceTypeId) {
          const { data: defaultType } = await supabase
            .from('device_types')
            .select('id')
            .eq('code', 'fortigate')
            .eq('is_active', true)
            .single();
          
          deviceTypeId = defaultType?.id || null;
        }
      }

      // Get blueprint steps for this device type
      const steps = await getDeviceBlueprint(supabase, deviceTypeId, task.task_type);

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
        type: task.task_type === 'fortigate_compliance' ? 'data_collection' : task.task_type,
        target: targetData,
        steps: steps,
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
