import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AES-GCM decryption for stored secrets
async function decryptSecret(encryptedData: string, keyHex: string): Promise<string> {
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const [ivHex, ciphertextHex] = encryptedData.split(':');
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

// XOR encryption for transport (one-time use)
function encryptForTransport(text: string, key: string): string {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(textBytes.length);
  
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return btoa(String.fromCharCode(...result));
}

// Get token using Resource Owner Password Credentials (ROPC) flow
async function getTokenWithCredentials(
  tenantId: string,
  appId: string,
  clientSecret: string,
  adminEmail: string,
  adminPassword: string
): Promise<{ access_token: string; expires_in: number }> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'password',
    username: adminEmail,
    password: adminPassword,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Token error:', errorData);
    
    if (errorData.error === 'invalid_grant') {
      throw new Error('Credenciais inválidas. Verifique o email e senha do administrador.');
    }
    if (errorData.error === 'invalid_client') {
      throw new Error('Configuração do aplicativo inválida. Contate o suporte.');
    }
    if (errorData.error_description?.includes('AADSTS50126')) {
      throw new Error('Senha incorreta.');
    }
    if (errorData.error_description?.includes('AADSTS50034')) {
      throw new Error('Usuário não encontrado no tenant.');
    }
    if (errorData.error_description?.includes('AADSTS50053')) {
      throw new Error('Conta bloqueada. Muitas tentativas de login falharam.');
    }
    if (errorData.error_description?.includes('AADSTS50057')) {
      throw new Error('Conta desabilitada.');
    }
    if (errorData.error_description?.includes('AADSTS50076') || 
        errorData.error_description?.includes('AADSTS50079') ||
        errorData.suberror === 'basic_action') {
      throw new Error('Esta conta possui MFA (autenticação multifator) habilitado. Para conectar, use uma conta de serviço sem MFA ou desabilite o MFA temporariamente durante a configuração.');
    }
    
    throw new Error(errorData.error_description || 'Erro ao obter token de acesso.');
  }

  return await response.json();
}

// Fetch organization info from Graph API
async function fetchOrganizationInfo(accessToken: string): Promise<{
  displayName: string;
  primaryDomain: string;
  tenantId: string;
}> {
  const response = await fetch('https://graph.microsoft.com/v1.0/organization', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Não foi possível obter informações da organização.');
  }

  const data = await response.json();
  const org = data.value?.[0];
  
  if (!org) {
    throw new Error('Organização não encontrada.');
  }

  const verifiedDomains = org.verifiedDomains || [];
  const primaryDomain = verifiedDomains.find((d: any) => d.isDefault)?.name || 
                        verifiedDomains[0]?.name || 
                        `${org.id}.onmicrosoft.com`;

  return {
    displayName: org.displayName || 'Unknown Organization',
    primaryDomain,
    tenantId: org.id,
  };
}

// Fetch Service Principal Object ID automatically
async function fetchServicePrincipalId(accessToken: string, appId: string): Promise<string> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error('Não foi possível buscar o Service Principal.');
  }

  const data = await response.json();
  const sp = data.value?.[0];
  
  if (!sp) {
    throw new Error('Service Principal não encontrado. O administrador precisa autorizar o aplicativo primeiro.');
  }

  return sp.id;
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
    const encryptionKey = Deno.env.get("M365_ENCRYPTION_KEY")!;
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

    // Parse request
    const { workspaceId, adminEmail, adminPassword } = await req.json();

    if (!workspaceId || !adminEmail || !adminPassword) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: workspaceId, adminEmail, adminPassword" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    if (!adminEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract tenant ID from email domain
    const emailDomain = adminEmail.split('@')[1];
    
    console.log(`[connect-m365-tenant] Starting connection for ${emailDomain} to workspace ${workspaceId}`);

    // Step 1: Get global config (App ID, Client Secret)
    const { data: globalConfig, error: configError } = await supabase
      .from('m365_global_config')
      .select('app_id, client_secret_encrypted')
      .limit(1)
      .single();

    if (configError || !globalConfig) {
      console.error("Global config not found:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração do M365 não encontrada. Contate o administrador." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt client secret
    const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted, encryptionKey);

    // Step 2: Get tenant ID by trying to authenticate
    // First, try to discover tenant ID from email domain
    let tenantId: string;
    try {
      // Use OpenID configuration to discover tenant ID
      const wellKnownUrl = `https://login.microsoftonline.com/${emailDomain}/v2.0/.well-known/openid-configuration`;
      const wellKnownResponse = await fetch(wellKnownUrl);
      
      if (wellKnownResponse.ok) {
        const wellKnown = await wellKnownResponse.json();
        // Extract tenant ID from issuer: https://login.microsoftonline.com/{tenant-id}/v2.0
        const issuer = wellKnown.issuer;
        const match = issuer.match(/login\.microsoftonline\.com\/([^/]+)/);
        tenantId = match?.[1] || emailDomain;
      } else {
        // Fall back to using domain as tenant identifier
        tenantId = emailDomain;
      }
    } catch (e) {
      tenantId = emailDomain;
    }

    console.log(`[connect-m365-tenant] Resolved tenant ID: ${tenantId}`);

    // Step 3: Get token using ROPC flow
    let tokenData;
    try {
      tokenData = await getTokenWithCredentials(
        tenantId,
        globalConfig.app_id,
        clientSecret,
        adminEmail,
        adminPassword
      );
    } catch (tokenError: any) {
      console.error("Token acquisition failed:", tokenError);
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Fetch organization info
    const orgInfo = await fetchOrganizationInfo(tokenData.access_token);
    console.log(`[connect-m365-tenant] Organization: ${orgInfo.displayName} (${orgInfo.primaryDomain})`);

    // Step 5: Fetch Service Principal Object ID automatically
    let spObjectId: string;
    try {
      spObjectId = await fetchServicePrincipalId(tokenData.access_token, globalConfig.app_id);
      console.log(`[connect-m365-tenant] Service Principal Object ID: ${spObjectId}`);
    } catch (spError: any) {
      console.error("Service Principal lookup failed:", spError);
      return new Response(
        JSON.stringify({ 
          error: "Service Principal não encontrado. Execute o Admin Consent primeiro.",
          code: "SP_NOT_FOUND"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 6: Check if tenant already exists for this workspace
    const { data: existingTenant } = await supabase
      .from('m365_tenants')
      .select('id')
      .eq('client_id', workspaceId)
      .eq('tenant_id', orgInfo.tenantId)
      .single();

    if (existingTenant) {
      return new Response(
        JSON.stringify({ 
          error: "Este tenant já está conectado a este workspace.",
          code: "TENANT_EXISTS" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 7: Create tenant record
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .insert({
        client_id: workspaceId,
        tenant_id: orgInfo.tenantId,
        tenant_domain: orgInfo.primaryDomain,
        display_name: orgInfo.displayName,
        connection_status: 'connected',
        created_by: user.id,
        last_validated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Tenant creation failed:", tenantError);
      throw tenantError;
    }

    console.log(`[connect-m365-tenant] Tenant created: ${tenant.id}`);

    // Step 8: Create app credentials record
    await supabase
      .from('m365_app_credentials')
      .insert({
        tenant_record_id: tenant.id,
        azure_app_id: globalConfig.app_id,
        auth_type: 'client_secret',
        is_active: true,
        created_by: user.id,
      });

    // Step 9: Find and link agent from workspace automatically
    const { data: workspaceAgent } = await supabase
      .from('agents')
      .select('id, name, certificate_thumbprint')
      .eq('client_id', workspaceId)
      .eq('revoked', false)
      .not('certificate_thumbprint', 'is', null)
      .limit(1)
      .single();

    if (workspaceAgent) {
      await supabase
        .from('m365_tenant_agents')
        .insert({
          tenant_record_id: tenant.id,
          agent_id: workspaceAgent.id,
          enabled: true,
        });

      console.log(`[connect-m365-tenant] Agent ${workspaceAgent.id} linked to tenant`);

      // Step 10: Create Exchange RBAC setup task
      const transportKey = crypto.randomUUID();
      const encryptedPassword = encryptForTransport(adminPassword, transportKey);

      const setupCommands = [
        {
          name: "register_service_principal",
          command: `New-ServicePrincipal -AppId "${globalConfig.app_id}" -ObjectId "${spObjectId}" -DisplayName "iScope Security"`,
        },
        {
          name: "assign_exchange_role",
          command: `New-ManagementRoleAssignment -App "${globalConfig.app_id}" -Role "Exchange Recipient Administrator"`,
        },
      ];

      const { error: taskError } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: workspaceAgent.id,
          task_type: 'm365_powershell',
          target_id: tenant.id,
          target_type: 'm365_tenant',
          priority: 10,
          payload: {
            type: 'exchange_rbac_setup',
            module: 'ExchangeOnline',
            auth_mode: 'credential',
            username: adminEmail,
            password_encrypted: encryptedPassword,
            transport_key: transportKey,
            commands: setupCommands,
            tenant_id: orgInfo.tenantId,
            organization: orgInfo.primaryDomain,
          },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });

      if (taskError) {
        console.warn("Exchange RBAC task creation failed:", taskError);
        // Don't fail the whole operation, just log it
      } else {
        console.log(`[connect-m365-tenant] Exchange RBAC setup task created`);
      }
    }

    // Step 11: Create audit log
    await supabase.from('m365_audit_logs').insert({
      action: 'tenant_connected',
      user_id: user.id,
      client_id: workspaceId,
      tenant_record_id: tenant.id,
      action_details: {
        tenant_id: orgInfo.tenantId,
        display_name: orgInfo.displayName,
        domain: orgInfo.primaryDomain,
        agent_linked: !!workspaceAgent,
        sp_object_id: spObjectId,
      },
    });

    console.log(`[connect-m365-tenant] Connection complete for ${orgInfo.displayName}`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantRecordId: tenant.id,
        displayName: orgInfo.displayName,
        domain: orgInfo.primaryDomain,
        tenantId: orgInfo.tenantId,
        agentLinked: !!workspaceAgent,
        message: workspaceAgent 
          ? "Tenant conectado! Configuração do Exchange em andamento..."
          : "Tenant conectado! Vincule um agent para análises avançadas.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in connect-m365-tenant:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
