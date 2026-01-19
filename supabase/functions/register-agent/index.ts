import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a cryptographically secure random string
function generateSecureSecret(length: number = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Generate a JWT token signed with the agent's secret
async function generateAgentToken(
  agentId: string,
  jwtSecret: string,
  expiresIn: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(jwtSecret);
  const now = Math.floor(Date.now() / 1000);
  
  let exp: number;
  if (expiresIn.endsWith("m")) {
    exp = now + parseInt(expiresIn) * 60;
  } else if (expiresIn.endsWith("h")) {
    exp = now + parseInt(expiresIn) * 60 * 60;
  } else if (expiresIn.endsWith("d")) {
    exp = now + parseInt(expiresIn) * 60 * 60 * 24;
  } else {
    exp = now + 30 * 60; // Default 30 minutes
  }

  const jwt = await new jose.SignJWT({ agent_id: agentId, type: expiresIn.includes("d") ? "refresh" : "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setSubject(agentId)
    .sign(secretKey);

  return jwt;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    console.log(`[register-agent] Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const { activation_code } = body;

    console.log(`[register-agent] Registration attempt with code: ${activation_code?.substring(0, 4)}...`);

    if (!activation_code || typeof activation_code !== "string") {
      console.log("[register-agent] Missing or invalid activation_code");
      return new Response(
        JSON.stringify({ error: "activation_code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with SERVICE ROLE to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Find agent by activation_code
    console.log("[register-agent] Looking up agent by activation code...");
    
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("activation_code", activation_code)
      .single();

    if (agentError || !agent) {
      console.log(`[register-agent] Agent not found: ${agentError?.message || "No agent with this code"}`);
      return new Response(
        JSON.stringify({ error: "Invalid activation code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[register-agent] Found agent: ${agent.id} (${agent.name})`);

    // Step 2: Validate agent state
    // Check if revoked
    if (agent.revoked) {
      console.log(`[register-agent] Agent ${agent.id} is revoked`);
      return new Response(
        JSON.stringify({ error: "Agent has been revoked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code expired
    if (agent.activation_code_expires_at) {
      const expiresAt = new Date(agent.activation_code_expires_at);
      if (expiresAt < new Date()) {
        console.log(`[register-agent] Activation code expired at ${agent.activation_code_expires_at}`);
        return new Response(
          JSON.stringify({ error: "Activation code has expired" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 3: Check if already registered (jwt_secret exists)
    if (agent.jwt_secret) {
      console.log(`[register-agent] Agent ${agent.id} is already registered`);
      return new Response(
        JSON.stringify({ error: "Agent is already registered" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Generate secrets and tokens
    console.log(`[register-agent] Generating credentials for agent ${agent.id}...`);
    
    const jwtSecret = generateSecureSecret(64);
    const accessToken = await generateAgentToken(agent.id, jwtSecret, "30m");
    const refreshToken = await generateAgentToken(agent.id, jwtSecret, "90d");

    console.log("[register-agent] Tokens generated successfully");

    // Step 5: Update agent with jwt_secret and clear activation code
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        jwt_secret: jwtSecret,
        activation_code: null,
        activation_code_expires_at: null,
        last_seen: new Date().toISOString(),
      })
      .eq("id", agent.id);

    if (updateError) {
      console.error(`[register-agent] Failed to update agent: ${updateError.message}`);
      return new Response(
        JSON.stringify({ error: "Failed to register agent" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[register-agent] Agent ${agent.id} registered successfully`);

    // Step 6: Return tokens
    return new Response(
      JSON.stringify({
        agent_id: agent.id,
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[register-agent] Unexpected error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
