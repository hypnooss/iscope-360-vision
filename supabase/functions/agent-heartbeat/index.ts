import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HeartbeatRequest {
  status: string;
  agent_version: string;
}

interface HeartbeatSuccessResponse {
  success: true;
  agent_id: string;
  timestamp: string;
  next_heartbeat_in: number;
  config_flag: 0 | 1;
}

interface HeartbeatErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'INTERNAL_ERROR';
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
        JSON.stringify({ error: 'Token de autorização ausente ou inválido', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Decode token without verification first to get the agent_id (sub claim)
    let payload: { sub?: string; exp?: number };
    try {
      const [, payloadBase64] = decode(token);
      payload = payloadBase64 as { sub?: string; exp?: number };
    } catch (decodeError) {
      console.error('Failed to decode token:', decodeError);
      return new Response(
        JSON.stringify({ error: 'Token inválido', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = payload.sub;
    if (!agentId) {
      console.log('Token does not contain agent ID (sub claim)');
      return new Response(
        JSON.stringify({ error: 'Token não contém identificação do agent', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
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
      .select('id, jwt_secret, revoked, config_updated_at, config_fetched_at')
      .eq('id', agentId)
      .single();

    if (fetchError || !agent) {
      console.log('Agent not found:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is revoked
    if (agent.revoked) {
      console.log('Agent is blocked:', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as HeartbeatErrorResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent has jwt_secret (is registered)
    if (!agent.jwt_secret) {
      console.log('Agent is not registered (no jwt_secret):', agentId);
      return new Response(
        JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as HeartbeatErrorResponse),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration BEFORE signature verification
    // This allows the agent to know specifically that it should refresh
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token signature using agent's jwt_secret
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
        JSON.stringify({ error: 'Assinatura do token inválida', code: 'INVALID_SIGNATURE' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: HeartbeatRequest;
    try {
      body = await req.json();
    } catch {
      body = { status: 'unknown', agent_version: 'unknown' };
    }

    console.log(`Heartbeat received from agent ${agentId}: status=${body.status}, version=${body.agent_version}`);

    // Update last_seen timestamp
    const { error: updateError } = await supabase
      .from('agents')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', agentId);

    if (updateError) {
      console.error('Failed to update last_seen:', updateError);
      // Continue anyway - heartbeat should still succeed
    }

    // Calculate config_flag
    const configUpdatedAt = agent.config_updated_at ? new Date(agent.config_updated_at).getTime() : 0;
    const configFetchedAt = agent.config_fetched_at ? new Date(agent.config_fetched_at).getTime() : 0;
    const configFlag: 0 | 1 = configUpdatedAt > configFetchedAt ? 1 : 0;

    // Build success response
    const response: HeartbeatSuccessResponse = {
      success: true,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      next_heartbeat_in: 60,
      config_flag: configFlag,
    };

    console.log(`Heartbeat success for agent ${agentId}: config_flag=${configFlag}`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in agent-heartbeat:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
