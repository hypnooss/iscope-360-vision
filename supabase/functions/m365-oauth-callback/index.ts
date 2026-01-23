import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatePayload {
  tenant_record_id: string;
  client_id: string;
  tenant_id: string;
  redirect_url: string;
}

const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'Policy.Read.All',
];

const OPTIONAL_PERMISSIONS = [
  'Reports.Read.All', // Requires Azure AD Premium
];

// ============= AES-256-GCM Decryption =============

// Derive CryptoKey from hex string
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('M365_ENCRYPTION_KEY not configured or invalid (must be 64 hex characters)');
  }
  
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(keyHex.substr(i * 2, 2), 16);
  }
  
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Convert hex string to Uint8Array with proper ArrayBuffer
function fromHex(hex: string): Uint8Array {
  const length = hex.length / 2;
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Decrypt secret using AES-256-GCM
// Supports legacy Base64 format for backwards compatibility
async function decryptSecret(encrypted: string): Promise<string> {
  if (encrypted.includes(':')) {
    try {
      const [ivHex, ctHex] = encrypted.split(':');
      const key = await getEncryptionKey();
      const iv = fromHex(ivHex);
      const ciphertext = fromHex(ctHex);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as Uint8Array<ArrayBuffer> },
        key,
        ciphertext as unknown as Uint8Array<ArrayBuffer>
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('AES-GCM decryption failed:', error);
      return '';
    }
  }
  
  // Legacy Base64 fallback
  try {
    console.warn('Using legacy Base64 decryption - please re-save config to upgrade to AES-GCM');
    return atob(encrypted);
  } catch {
    return '';
  }
}

// Get M365 credentials from database or environment variables
async function getM365Credentials(supabaseUrl: string, supabaseServiceKey: string): Promise<{ appId: string; clientSecret: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // First try to get from database
  const { data: configData, error: configError } = await supabase
    .from('m365_global_config')
    .select('app_id, client_secret_encrypted')
    .limit(1)
    .maybeSingle();

  if (!configError && configData) {
    const config = configData as { app_id?: string; client_secret_encrypted?: string };
    if (config.app_id && config.client_secret_encrypted) {
      const clientSecret = await decryptSecret(config.client_secret_encrypted);
      if (clientSecret) {
        console.log('Using M365 credentials from database (AES-GCM encrypted)');
        return { appId: config.app_id, clientSecret };
      }
    }
  }

  // Fallback to environment variables
  const appId = Deno.env.get('M365_MULTI_TENANT_APP_ID');
  const clientSecret = Deno.env.get('M365_MULTI_TENANT_CLIENT_SECRET');

  if (appId && clientSecret) {
    console.log('Using M365 credentials from environment variables');
    return { appId, clientSecret };
  }

  return null;
}

// ============= Main Handler =============

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    if (error) {
      console.error('OAuth error from Microsoft:', error, errorDescription);
      let redirectUrl = '/scope-m365/oauth-callback';
      try {
        const stateData = JSON.parse(atob(url.searchParams.get('state')!));
        redirectUrl = stateData.redirect_url?.replace('/tenant-connection', '/oauth-callback') || redirectUrl;
      } catch {}
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
        },
      });
    }

    const stateParam = url.searchParams.get('state');
    if (!stateParam) {
      throw new Error('Missing state parameter');
    }

    let statePayload: StatePayload;
    try {
      statePayload = JSON.parse(atob(stateParam));
    } catch {
      throw new Error('Invalid state parameter');
    }

    const { tenant_record_id, client_id, tenant_id, redirect_url } = statePayload;

    // Initialize Supabase client for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get M365 credentials from database (preferred) or env vars (fallback)
    const credentials = await getM365Credentials(supabaseUrl, supabaseServiceKey);
    if (!credentials) {
      throw new Error('Multi-tenant app credentials not configured');
    }

    const { appId, clientSecret } = credentials;

    // Test the connection by getting a token using client credentials
    console.log('Getting token for tenant:', tenant_id);
    
    const tokenUrl = `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: appId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Token error:', tokenError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirect_url}?error=token_failed&error_description=${encodeURIComponent('Failed to obtain access token. Admin consent may not have been granted.')}`,
        },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Token obtained successfully, expires_in:', tokenData.expires_in);

    // Decode and log token claims for debugging
    try {
      const tokenParts = accessToken.split('.');
      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      console.log('Token claims:', {
        appid: tokenPayload.appid,
        tid: tokenPayload.tid,
        aud: tokenPayload.aud,
        iss: tokenPayload.iss,
        exp: new Date(tokenPayload.exp * 1000).toISOString(),
      });
    } catch (decodeErr) {
      console.warn('Could not decode token for logging:', decodeErr);
    }

    // Test Graph API access using /domains endpoint (more resilient than /organization)
    console.log('Testing Graph API access with /domains endpoint...');
    
    const fetchDomains = async () => {
      return await fetch('https://graph.microsoft.com/v1.0/domains', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
    };
    
    // Retry with exponential backoff: 5s, 10s, 15s (total 30s max wait)
    const delays = [5000, 10000, 15000];
    let domainsResponse = await fetchDomains();
    let lastError: { code?: string; message?: string } = {};

    for (let attempt = 0; !domainsResponse.ok && attempt < delays.length; attempt++) {
      const errorText = await domainsResponse.text();
      try {
        lastError = JSON.parse(errorText).error || { message: errorText };
      } catch {
        lastError = { code: 'UnknownError', message: errorText };
      }
      
      console.error(`Graph API error (attempt ${attempt + 1}):`, {
        status: domainsResponse.status,
        code: lastError.code,
        message: lastError.message,
      });
      
      // Only retry on propagation-related errors
      if (lastError.code === 'Authorization_IdentityNotFound' || 
          lastError.code === 'Authorization_RequestDenied' ||
          domainsResponse.status === 401 ||
          domainsResponse.status === 403) {
        console.log(`Waiting ${delays[attempt]/1000}s for Admin Consent propagation (attempt ${attempt + 2})...`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        domainsResponse = await fetchDomains();
      } else {
        break; // Don't retry on other errors
      }
    }

    if (!domainsResponse.ok) {
      const finalErrorText = await domainsResponse.text();
      let finalError;
      try {
        finalError = JSON.parse(finalErrorText).error || { message: finalErrorText };
      } catch {
        finalError = { code: 'UnknownError', message: finalErrorText };
      }
      
      console.error('Graph API error (final):', {
        status: domainsResponse.status,
        code: finalError.code,
        message: finalError.message,
      });
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirect_url}?error=graph_access_failed&error_description=${encodeURIComponent(`Failed to access Microsoft Graph API after retries: ${finalError.message || 'Unknown error'}. O Admin Consent pode levar alguns minutos para propagar. Tente novamente em 2-3 minutos.`)}`,
        },
      });
    }

    const domainsData = await domainsResponse.json();
    const domains = domainsData.value || [];
    console.log('Domains retrieved:', domains.length);
    
    // Extract primary domain and display name from domains
    const defaultDomain = domains.find((d: any) => d.isDefault);
    const initialDomain = domains.find((d: any) => d.isInitial);
    const primaryDomain = defaultDomain?.id || initialDomain?.id || domains[0]?.id || null;
    
    // Try to get organization display name (optional, don't fail if unavailable)
    let displayName = primaryDomain; // Fallback to domain
    try {
      const orgResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        displayName = orgData.value?.[0]?.displayName || primaryDomain;
      }
    } catch (orgErr) {
      console.warn('Could not fetch organization name, using domain as fallback');
    }

    // Test permissions
    console.log('Testing permissions...');
    const permissionResults: { name: string; granted: boolean; required: boolean; optional?: boolean; error?: string }[] = [];
    
    // Helper function to test Directory.Read.All with fallback (same strategy as validate-m365-connection)
    async function testDirectoryPermission(): Promise<{ granted: boolean; error?: string }> {
      // First try /domains (more reliable across tenant types)
      const domainsTestResponse = await fetch('https://graph.microsoft.com/v1.0/domains?$top=1', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (domainsTestResponse.ok) {
        return { granted: true };
      }
      
      // Fallback to /directoryRoles
      const rolesResponse = await fetch('https://graph.microsoft.com/v1.0/directoryRoles?$top=1&$select=id', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (rolesResponse.ok) {
        return { granted: true };
      }
      
      // Return error from the last test
      try {
        const errorBody = await rolesResponse.json();
        return { 
          granted: false, 
          error: errorBody?.error?.code || `HTTP ${rolesResponse.status}` 
        };
      } catch {
        return { granted: false, error: `HTTP ${rolesResponse.status}` };
      }
    }
    
    // Standard permission tests (excluding Directory.Read.All which has custom logic)
    const permissionTests = [
      { permission: 'User.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/users?$top=1' },
      { permission: 'Group.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/groups?$top=1' },
      { permission: 'Application.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/applications?$top=1' },
      { permission: 'AuditLog.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=1' },
      { permission: 'Policy.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy' },
      { permission: 'Reports.Read.All', endpoint: 'https://graph.microsoft.com/beta/reports/authenticationMethods/userRegistrationDetails?$top=1' },
    ];

    // Test Directory.Read.All with fallback strategy
    const directoryResult = await testDirectoryPermission();
    console.log(`Permission test for Directory.Read.All: ${directoryResult.granted ? 'OK' : 'FAILED'} ${directoryResult.error ? `- ${directoryResult.error}` : ''}`);
    permissionResults.push({
      name: 'Directory.Read.All',
      granted: directoryResult.granted,
      required: true,
      error: directoryResult.error,
    });

    // Test other permissions
    for (const test of permissionTests) {
      try {
        const testResponse = await fetch(test.endpoint, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        const isRequired = REQUIRED_PERMISSIONS.includes(test.permission);
        const isOptional = OPTIONAL_PERMISSIONS.includes(test.permission);
        
        let errorDetail: string | undefined;
        if (!testResponse.ok) {
          try {
            const errorBody = await testResponse.json();
            errorDetail = errorBody?.error?.code || errorBody?.error?.message || `HTTP ${testResponse.status}`;
          } catch {
            errorDetail = `HTTP ${testResponse.status}`;
          }
          console.log(`Permission test for ${test.permission}: FAILED - ${errorDetail}`);
        } else {
          console.log(`Permission test for ${test.permission}: OK`);
        }
        
        permissionResults.push({
          name: test.permission,
          granted: testResponse.ok,
          required: isRequired,
          optional: isOptional,
          error: errorDetail,
        });
      } catch (err) {
        console.error(`Permission test failed for ${test.permission}:`, err);
        permissionResults.push({
          name: test.permission,
          granted: false,
          required: REQUIRED_PERMISSIONS.includes(test.permission),
          optional: OPTIONAL_PERMISSIONS.includes(test.permission),
          error: String(err),
        });
      }
    }

    console.log('Permission test results:', JSON.stringify(permissionResults));

    const allPermissionsGranted = permissionResults
      .filter(p => p.required)
      .every(p => p.granted);

    const missingPermissions = permissionResults
      .filter(p => p.required && !p.granted)
      .map(p => p.name);

    // Update tenant record
    const connectionStatus = allPermissionsGranted ? 'connected' : 'pending';
    
    const { error: updateError } = await supabase
      .from('m365_tenants')
      .update({
        connection_status: connectionStatus,
        display_name: displayName,
        tenant_domain: primaryDomain,
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', tenant_record_id);

    if (updateError) {
      console.error('Failed to update tenant:', updateError);
      throw new Error('Failed to update tenant record');
    }

    // Store credentials reference (using multi-tenant app)
    const { error: credError } = await supabase
      .from('m365_app_credentials')
      .upsert({
        tenant_record_id,
        azure_app_id: appId,
        auth_type: 'multi_tenant_app',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_record_id',
      });

    if (credError) {
      console.error('Failed to store credentials:', credError);
    }

    // Enable Entra ID submodule
    const { error: submoduleError } = await supabase
      .from('m365_tenant_submodules')
      .upsert({
        tenant_record_id,
        submodule: 'entra_id',
        is_enabled: true,
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_record_id,submodule',
      });

    if (submoduleError) {
      console.error('Failed to enable submodule:', submoduleError);
    }

    // Store permission status with error reason
    for (const perm of permissionResults) {
      // Translate common Azure error codes to user-friendly messages
      let errorReason: string | null = null;
      if (!perm.granted && perm.error) {
        if (perm.error.includes('NonPremiumTenant') || perm.error.includes('RequestFromNonPremiumTenantOrB2CTenant')) {
          errorReason = 'Requer Azure AD Premium P1/P2';
        } else if (perm.error.includes('Authorization_RequestDenied')) {
          errorReason = 'Permissão negada pelo administrador';
        } else if (perm.error.includes('Request_UnsupportedQuery')) {
          errorReason = 'Recurso não suportado neste tenant';
        } else {
          errorReason = perm.error;
        }
      }

      await supabase
        .from('m365_tenant_permissions')
        .upsert({
          tenant_record_id,
          permission_name: perm.name,
          permission_type: 'Application',
          status: perm.granted ? 'granted' : 'pending',
          granted_at: perm.granted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          error_reason: errorReason,
        }, {
          onConflict: 'tenant_record_id,permission_name',
        });
    }

    // Write audit log
    await supabase
      .from('m365_audit_logs')
      .insert({
        tenant_record_id,
        client_id,
        action: 'tenant_connected_oauth',
        action_details: {
          connection_method: 'multi_tenant_app',
          credentials_source: 'database_encrypted',
          permissions_granted: permissionResults.filter(p => p.granted).map(p => p.name),
          permissions_missing: missingPermissions,
          tenant_display_name: displayName,
          tenant_domain: primaryDomain,
        },
      });

    // Redirect to the dedicated callback page (not the main tenant connection page)
    // This page will display appropriate feedback and communicate with the parent window
    const callbackPage = redirect_url.replace('/tenant-connection', '/oauth-callback');
    const successUrl = allPermissionsGranted
      ? `${callbackPage}?success=true&tenant_id=${tenant_record_id}`
      : `${callbackPage}?success=partial&tenant_id=${tenant_record_id}&missing=${encodeURIComponent(missingPermissions.join(','))}`;

    console.log('Redirecting to:', successUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': successUrl,
      },
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/scope-m365/oauth-callback?error=callback_failed&error_description=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
