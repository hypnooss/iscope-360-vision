import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  tenant_id: string;
  app_id: string;
  client_secret: string;
  tenant_record_id?: string; // If updating existing tenant
}

interface PermissionStatus {
  name: string;
  granted: boolean;
  required: boolean;
}

// Required permissions for Entra ID and Exchange Online modules
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];

// ========== Encryption Utilities ==========
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex) {
    throw new Error('M365_ENCRYPTION_KEY not configured');
  }
  const keyBytes = fromHex(keyHex);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function decryptSecret(encrypted: string): Promise<string> {
  // Check if this is in the new encrypted format (iv:ciphertext)
  if (encrypted.includes(':')) {
    const [ivHex, ciphertextHex] = encrypted.split(':');
    const iv = fromHex(ivHex);
    const ciphertext = fromHex(ciphertextHex);
    
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  // Fallback: assume it's a plain text or Base64 encoded secret (legacy)
  try {
    return atob(encrypted);
  } catch {
    // If not Base64, return as-is (plain text)
    return encrypted;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ValidationRequest = await req.json();
    const { tenant_id, app_id, client_secret, tenant_record_id } = body;

    if (!tenant_id || !app_id || !client_secret) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, app_id, and client_secret are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the client secret
    let decryptedSecret: string;
    try {
      decryptedSecret = await decryptSecret(client_secret);
      console.log('Client secret decrypted successfully');
    } catch (e) {
      console.error('Failed to decrypt client secret:', e);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Falha ao decriptar client secret.',
          details: 'A chave de criptografia pode estar incorreta ou o secret está corrompido.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Try to get an access token using Client Credentials flow
    console.log(`Attempting to get token for tenant: ${tenant_id}`);
    
    const tokenUrl = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: app_id,
      client_secret: decryptedSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      
      let errorMessage = 'Falha ao obter token de acesso.';
      let errorDetails = '';
      
      if (tokenData.error === 'invalid_client') {
        errorMessage = 'Client ID ou Client Secret inválido.';
        errorDetails = 'Verifique se o Application (Client) ID e o Client Secret estão corretos. Lembre-se: copie o VALUE do secret, não o Secret ID.';
      } else if (tokenData.error === 'unauthorized_client') {
        errorMessage = 'O aplicativo não está autorizado.';
        errorDetails = 'O App Registration pode não existir ou o Client Secret expirou.';
      } else if (tokenData.error_description?.includes('not found')) {
        errorMessage = 'Tenant ou aplicativo não encontrado.';
        errorDetails = 'Verifique se o Tenant ID e o Application ID estão corretos.';
      }

      // Update tenant status to failed if tenant_record_id provided
      if (tenant_record_id) {
        await supabase
          .from('m365_tenants')
          .update({
            connection_status: 'failed',
            last_validated_at: new Date().toISOString(),
          })
          .eq('id', tenant_record_id);
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          error: errorMessage,
          details: errorDetails,
          step: 'token',
          raw_error: tokenData.error_description || tokenData.error,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;
    console.log('Token obtained successfully');

    // Step 2: Test a basic Graph API call
    const meResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!meResponse.ok) {
      const errorData = await meResponse.json();
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Falha ao acessar Microsoft Graph.',
          details: 'O token foi obtido mas não foi possível acessar a API do Graph.',
          step: 'graph_access',
          raw_error: errorData.error?.message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgData = await meResponse.json();
    const tenantDisplayName = orgData.value?.[0]?.displayName || 'Unknown';
    const verifiedDomains = orgData.value?.[0]?.verifiedDomains?.map((d: any) => d.name) || [];
    console.log('Graph access confirmed for:', tenantDisplayName);

    // Step 3: Check each required permission
    const permissionResults: PermissionStatus[] = [];
    
    for (const permission of REQUIRED_PERMISSIONS) {
      let granted = false;
      
      try {
        // Test each permission with a minimal API call
        if (permission === 'User.Read.All') {
          const response = await fetch('https://graph.microsoft.com/v1.0/users?$top=1&$select=id', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          granted = response.ok;
          console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
        } else if (permission === 'Directory.Read.All') {
          // Use /domains endpoint which specifically requires Directory.Read.All
          const response = await fetch('https://graph.microsoft.com/v1.0/domains?$top=1', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          granted = response.ok;
          console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
          
          // Fallback to /directoryRoles if domains fails
          if (!granted) {
            const fallbackResponse = await fetch('https://graph.microsoft.com/v1.0/directoryRoles?$top=1&$select=id', {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            granted = fallbackResponse.ok;
            console.log(`Permission ${permission} fallback: ${fallbackResponse.status} - granted: ${granted}`);
          }
        } else if (permission === 'Group.Read.All') {
          const response = await fetch('https://graph.microsoft.com/v1.0/groups?$top=1&$select=id', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          granted = response.ok;
          console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
        } else if (permission === 'Application.Read.All') {
          const response = await fetch('https://graph.microsoft.com/v1.0/applications?$top=1&$select=id', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          granted = response.ok;
          console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
        } else if (permission === 'AuditLog.Read.All') {
          // Try directoryAudits first (more reliable), then signIns
          const response = await fetch('https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$top=1', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          // AuditLog might return 403 if not licensed (Azure AD Premium required)
          // 400 can mean permission exists but query issue
          // We consider it granted if we get 200, 400 (query issue), or if we can at least call the endpoint
          granted = response.ok || response.status === 400;
          console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
          
          // If directoryAudits fails with 403, try signIns as fallback
          if (!granted && response.status === 403) {
            const signInsResponse = await fetch('https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=1', {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            granted = signInsResponse.ok || signInsResponse.status === 400;
            console.log(`Permission ${permission} fallback: ${signInsResponse.status} - granted: ${granted}`);
          }
        } else if (permission === 'MailboxSettings.Read') {
          // Primeiro buscar um usuário (mailboxSettings não funciona em queries de coleção)
          const usersResp = await fetch('https://graph.microsoft.com/v1.0/users?$top=1&$select=id', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (usersResp.ok) {
            const usersData = await usersResp.json();
            const userId = usersData.value?.[0]?.id;
            if (userId) {
              // Testar mailboxSettings no usuário específico
              const mailboxResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/mailboxSettings`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              granted = mailboxResponse.ok;
              console.log(`Permission ${permission}: ${mailboxResponse.status} - granted: ${granted}`);
            } else {
              console.log(`Permission ${permission}: no users found to test - granted: false`);
            }
          } else {
            console.log(`Permission ${permission}: could not fetch users - granted: false`);
          }
        } else if (permission === 'Mail.Read') {
          // Test by getting a user first, then try to access their inbox rules
          const usersResponse = await fetch('https://graph.microsoft.com/v1.0/users?$top=1&$select=id', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const userId = usersData.value?.[0]?.id;
            if (userId) {
              const rulesResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/mailFolders/inbox/messageRules?$top=1`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
              });
              granted = rulesResponse.ok;
              console.log(`Permission ${permission}: ${rulesResponse.status} - granted: ${granted}`);
            } else {
              granted = false;
              console.log(`Permission ${permission}: no users found to test - granted: false`);
            }
          } else {
            granted = false;
            console.log(`Permission ${permission}: could not fetch users - granted: false`);
          }
        }
      } catch (e) {
        console.error(`Error testing ${permission}:`, e);
        granted = false;
      }
      
      permissionResults.push({
        name: permission,
        granted,
        required: true,
      });
    }

    const allPermissionsGranted = permissionResults.every(p => p.granted);
    const missingPermissions = permissionResults.filter(p => !p.granted).map(p => p.name);
    console.log(`Permission check complete: ${permissionResults.filter(p => p.granted).length}/${permissionResults.length} granted`);
    console.log(`Missing permissions: ${missingPermissions.join(', ') || 'none'}`);

    // Step 4: If tenant_record_id provided, update the tenant status
    if (tenant_record_id) {
      const connectionStatus = allPermissionsGranted ? 'connected' : 'partial';
      
      await supabase
        .from('m365_tenants')
        .update({
          connection_status: connectionStatus,
          display_name: tenantDisplayName,
          tenant_domain: verifiedDomains[0] || null,
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', tenant_record_id);

      // Update permission status in m365_tenant_permissions
      for (const perm of permissionResults) {
        const upsertResult = await supabase
          .from('m365_tenant_permissions')
          .upsert({
            tenant_record_id,
            permission_name: perm.name,
            permission_type: 'Application',
            status: perm.granted ? 'granted' : 'pending',
            granted_at: perm.granted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_record_id,permission_name',
          });
        
        if (upsertResult.error) {
          console.error(`Error upserting permission ${perm.name}:`, upsertResult.error);
        } else {
          console.log(`Permission ${perm.name} upserted: status=${perm.granted ? 'granted' : 'pending'}`);
        }
      }

      // Log the validation action
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id,
        user_id: user.id,
        action: 'connection_tested',
        action_details: {
          connection_status: connectionStatus,
          permissions_granted: permissionResults.filter(p => p.granted).length,
          permissions_total: permissionResults.length,
          missing_permissions: missingPermissions,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_valid: true,
        graph_access: true,
        tenant_info: {
          display_name: tenantDisplayName,
          verified_domains: verifiedDomains,
        },
        permissions: permissionResults,
        all_permissions_granted: allPermissionsGranted,
        missing_permissions: missingPermissions,
        connection_status: allPermissionsGranted ? 'connected' : 'partial',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro interno ao validar conexão.',
        details: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});