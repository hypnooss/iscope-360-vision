import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// XOR encryption for secure credential transport (same as powershell executor)
function xorEncrypt(text: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const textBytes = new TextEncoder().encode(text);
  const encrypted = new Uint8Array(textBytes.length);
  
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const body = await req.json();
    const { tenant_record_id, admin_email, admin_password } = body;

    if (!tenant_record_id || !admin_email || !admin_password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: tenant_record_id, admin_email, admin_password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[setup-exchange-rbac] Starting RBAC setup for tenant ${tenant_record_id}`);

    // Fetch tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .select(`
        id,
        tenant_id,
        tenant_domain,
        display_name,
        client_id
      `)
      .eq('id', tenant_record_id)
      .single();

    if (tenantError || !tenant) {
      console.error("Tenant not found:", tenantError);
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch app credentials (for app_id and sp_object_id)
    const { data: credentials, error: credError } = await supabase
      .from('m365_app_credentials')
      .select('azure_app_id, sp_object_id')
      .eq('tenant_record_id', tenant_record_id)
      .single();

    if (credError || !credentials) {
      console.error("Credentials not found:", credError);
      return new Response(
        JSON.stringify({ error: "Credenciais do app não encontradas. Complete a conexão do tenant primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credentials.sp_object_id) {
      return new Response(
        JSON.stringify({ error: "Service Principal Object ID não encontrado. Reconecte o tenant." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch linked agent
    const { data: tenantAgent, error: agentLinkError } = await supabase
      .from('m365_tenant_agents')
      .select(`
        agent_id,
        agents(id, name, jwt_secret, revoked)
      `)
      .eq('tenant_record_id', tenant_record_id)
      .eq('enabled', true)
      .single();

    if (agentLinkError || !tenantAgent) {
      console.error("Agent not linked:", agentLinkError);
      return new Response(
        JSON.stringify({ error: "Nenhum agent vinculado a este tenant. Vincule um agent primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agent = tenantAgent.agents as any;
    if (!agent || agent.revoked) {
      return new Response(
        JSON.stringify({ error: "Agent vinculado está inativo ou revogado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encrypt credentials using agent's JWT secret as key
    const encryptionKey = agent.jwt_secret || 'default-key-for-encryption';
    const encryptedPassword = xorEncrypt(admin_password, encryptionKey);

    // Build Exchange RBAC setup commands
    const setupCommands = [
      {
        name: "register_service_principal",
        command: `New-ServicePrincipal -AppId "${credentials.azure_app_id}" -ObjectId "${credentials.sp_object_id}" -DisplayName "iScope Security"`,
      },
      {
        name: "assign_exchange_role",
        command: `New-ManagementRoleAssignment -App "${credentials.azure_app_id}" -Role "Exchange Recipient Administrator"`,
      },
    ];

    console.log(`[setup-exchange-rbac] Creating task for agent ${agent.id}`);

    // Create agent task with credential-based auth
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agent.id,
        task_type: 'm365_powershell',
        target_id: tenant_record_id,
        target_type: 'm365_tenant',
        priority: 10,
        payload: {
          type: 'exchange_rbac_setup',
          module: 'ExchangeOnline',
          auth_mode: 'credential', // Uses admin credentials for initial setup
          username: admin_email,
          password_encrypted: encryptedPassword,
          transport_key: encryptionKey,
          commands: setupCommands,
          tenant_id: tenant.tenant_id,
          organization: tenant.tenant_domain,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (taskError) {
      console.error("Task creation failed:", taskError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar tarefa de configuração." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[setup-exchange-rbac] Task ${task.id} created successfully`);

    // Create audit log
    await supabase.from('m365_audit_logs').insert({
      action: 'exchange_rbac_setup_initiated',
      user_id: user.id,
      client_id: tenant.client_id,
      tenant_record_id: tenant_record_id,
      action_details: {
        task_id: task.id,
        agent_id: agent.id,
        admin_email: admin_email,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        task_id: task.id,
        message: "Configuração do Exchange RBAC iniciada. O agent processará a tarefa em breve.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[setup-exchange-rbac] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
