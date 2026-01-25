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
  has_pending_tasks: boolean;
}

interface HeartbeatErrorResponse {
  error: string;
  code: 'TOKEN_EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TOKEN' | 'BLOCKED' | 'UNREGISTERED' | 'INTERNAL_ERROR';
}

interface RpcHeartbeatResult {
  success: boolean;
  error?: string;
  agent_id?: string;
  jwt_secret?: string;
  config_flag?: number;
  has_pending_tasks?: boolean;
  next_heartbeat_in?: number;
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

    // Check token expiration BEFORE RPC call
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.log('Token has expired:', agentId);
      return new Response(
        JSON.stringify({ error: 'Token expirado', code: 'TOKEN_EXPIRED' } as HeartbeatErrorResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call optimized RPC (1 round-trip instead of 3 queries)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('rpc_agent_heartbeat', { p_agent_id: agentId });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = rpcResult as RpcHeartbeatResult;

    // Handle RPC-level errors
    if (!result.success) {
      const errorCode = result.error || 'INTERNAL_ERROR';
      
      if (errorCode === 'AGENT_NOT_FOUND') {
        return new Response(
          JSON.stringify({ error: 'Agent não encontrado', code: 'INVALID_TOKEN' } as HeartbeatErrorResponse),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (errorCode === 'BLOCKED') {
        return new Response(
          JSON.stringify({ error: 'Agent bloqueado', code: 'BLOCKED' } as HeartbeatErrorResponse),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (errorCode === 'UNREGISTERED') {
        return new Response(
          JSON.stringify({ error: 'Agent desregistrado', code: 'UNREGISTERED' } as HeartbeatErrorResponse),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Erro interno', code: 'INTERNAL_ERROR' } as HeartbeatErrorResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token signature using jwt_secret from RPC result
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(result.jwt_secret);
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

    // Parse request body for logging
    let body: HeartbeatRequest;
    try {
      body = await req.json();
    } catch {
      body = { status: 'unknown', agent_version: 'unknown' };
    }

    console.log(`Heartbeat OK: agent=${agentId}, version=${body.agent_version}, config_flag=${result.config_flag}, pending=${result.has_pending_tasks}`);

    // Build success response
    const response: HeartbeatSuccessResponse = {
      success: true,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      next_heartbeat_in: result.next_heartbeat_in || 120,
      config_flag: (result.config_flag || 0) as 0 | 1,
      has_pending_tasks: result.has_pending_tasks || false,
    };

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
