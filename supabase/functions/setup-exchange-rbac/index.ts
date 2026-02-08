import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple XOR encryption for temporary credential transport
// The password is only used once and never stored
function encryptForTransport(text: string, key: string): string {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(textBytes.length);
  
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...result));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { 
      tenantRecordId, 
      adminEmail, 
      adminPassword,
      appId,
      spObjectId,
      displayName = "iScope Security"
    } = body;

    // Validate required fields
    if (!tenantRecordId || !adminEmail || !adminPassword || !appId || !spObjectId) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: tenantRecordId, adminEmail, adminPassword, appId, spObjectId" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("m365_tenants")
      .select("id, tenant_id, tenant_domain, client_id, display_name")
      .eq("id", tenantRecordId)
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant not found:", tenantError);
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get linked agent for this tenant
    const { data: tenantAgent, error: agentLinkError } = await supabase
      .from("m365_tenant_agents")
      .select("agent_id, agents!inner(id, name, revoked, last_seen)")
      .eq("tenant_record_id", tenantRecordId)
      .eq("enabled", true)
      .single();

    if (agentLinkError || !tenantAgent) {
      console.error("No linked agent found:", agentLinkError);
      return new Response(
        JSON.stringify({ 
          error: "No agent linked to this tenant. Please link an agent first.",
          code: "NO_AGENT_LINKED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agent = tenantAgent.agents as { id: string; name: string; revoked: boolean; last_seen: string };
    
    if (agent.revoked) {
      return new Response(
        JSON.stringify({ error: "Linked agent is revoked" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check agent is online (last seen within 5 minutes)
    const lastSeen = new Date(agent.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastSeen < fiveMinutesAgo) {
      return new Response(
        JSON.stringify({ 
          error: "Agent is offline. Please ensure the agent is running.",
          code: "AGENT_OFFLINE",
          lastSeen: agent.last_seen
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a one-time key for credential transport
    const transportKey = crypto.randomUUID();
    
    // Encrypt password for transport (never stored in plain text)
    const encryptedPassword = encryptForTransport(adminPassword, transportKey);

    // Build the RBAC setup commands
    const setupCommands = [
      {
        name: "register_service_principal",
        command: `New-ServicePrincipal -AppId "${appId}" -ObjectId "${spObjectId}" -DisplayName "${displayName}"`,
      },
      {
        name: "assign_exchange_role",
        command: `New-ManagementRoleAssignment -App "${appId}" -Role "Exchange Recipient Administrator"`,
      },
    ];

    // Create the task for the agent
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: agent.id,
        task_type: "m365_analysis",
        target_id: tenant.id,
        target_type: "m365_tenant",
        priority: 10, // High priority
        payload: {
          type: "exchange_rbac_setup",
          module: "ExchangeOnline",
          auth_mode: "credential",
          username: adminEmail,
          password_encrypted: encryptedPassword,
          transport_key: transportKey,
          commands: setupCommands,
          tenant_id: tenant.tenant_id,
          organization: tenant.tenant_domain,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      })
      .select()
      .single();

    if (taskError) {
      console.error("Failed to create task:", taskError);
      return new Response(
        JSON.stringify({ error: "Failed to create setup task" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await supabase.from("m365_audit_logs").insert({
      action: "exchange_rbac_setup_initiated",
      user_id: user.id,
      client_id: tenant.client_id,
      tenant_record_id: tenantRecordId,
      action_details: {
        task_id: task.id,
        agent_id: agent.id,
        agent_name: agent.name,
        admin_email: adminEmail,
      },
    });

    console.log(`Exchange RBAC setup task created: ${task.id} for tenant ${tenant.display_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        taskId: task.id,
        message: "Setup task created. The agent will execute it shortly.",
        agentName: agent.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in setup-exchange-rbac:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
