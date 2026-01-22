import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Permissions to check
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All',
  'Organization.Read.All',
  'Domain.Read.All',
];

const RECOMMENDED_PERMISSIONS = [
  'Group.Read.All',
  'Application.Read.All',
  'Policy.Read.All',
  'RoleManagement.Read.Directory',
];

interface PermissionStatus {
  name: string;
  granted: boolean;
  type: 'required' | 'recommended';
}

// Simple decryption for the client secret
const decryptSecret = (encrypted: string): string => {
  try {
    return atob(encrypted);
  } catch {
    return '';
  }
};

async function testPermission(accessToken: string, permission: string): Promise<boolean> {
  try {
    let url = '';
    switch (permission) {
      case 'User.Read.All':
        url = 'https://graph.microsoft.com/v1.0/users?$top=1&$select=id';
        break;
      case 'Directory.Read.All':
        url = 'https://graph.microsoft.com/v1.0/directoryRoles?$top=1&$select=id';
        break;
      case 'Organization.Read.All':
        url = 'https://graph.microsoft.com/v1.0/organization?$top=1&$select=id';
        break;
      case 'Domain.Read.All':
        url = 'https://graph.microsoft.com/v1.0/domains?$top=1';
        break;
      case 'Group.Read.All':
        url = 'https://graph.microsoft.com/v1.0/groups?$top=1&$select=id';
        break;
      case 'Application.Read.All':
        url = 'https://graph.microsoft.com/v1.0/applications?$top=1&$select=id';
        break;
      case 'Policy.Read.All':
        url = 'https://graph.microsoft.com/v1.0/policies/authorizationPolicy';
        break;
      case 'RoleManagement.Read.Directory':
        url = 'https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions?$top=1';
        break;
      default:
        return false;
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function validatePermissions(tenantId: string, appId: string, clientSecret: string): Promise<PermissionStatus[]> {
  const results: PermissionStatus[] = [];
  
  try {
    // Get access token using client credentials
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
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
      // Can't get token, return all as not granted
      for (const perm of REQUIRED_PERMISSIONS) {
        results.push({ name: perm, granted: false, type: 'required' });
      }
      for (const perm of RECOMMENDED_PERMISSIONS) {
        results.push({ name: perm, granted: false, type: 'recommended' });
      }
      return results;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Test each permission
    for (const perm of REQUIRED_PERMISSIONS) {
      const granted = await testPermission(accessToken, perm);
      results.push({ name: perm, granted, type: 'required' });
    }
    
    for (const perm of RECOMMENDED_PERMISSIONS) {
      const granted = await testPermission(accessToken, perm);
      results.push({ name: perm, granted, type: 'recommended' });
    }

  } catch (error) {
    console.error('Error validating permissions:', error);
    // Return all as not granted on error
    for (const perm of REQUIRED_PERMISSIONS) {
      results.push({ name: perm, granted: false, type: 'required' });
    }
    for (const perm of RECOMMENDED_PERMISSIONS) {
      results.push({ name: perm, granted: false, type: 'recommended' });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we should validate permissions (passed as query param)
    const url = new URL(req.url);
    const shouldValidatePermissions = url.searchParams.get('validate_permissions') === 'true';
    const tenantIdForValidation = url.searchParams.get('tenant_id');

    // Default permissions status (all pending/yellow)
    const defaultPermissions: PermissionStatus[] = [
      ...REQUIRED_PERMISSIONS.map(name => ({ name, granted: false, type: 'required' as const })),
      ...RECOMMENDED_PERMISSIONS.map(name => ({ name, granted: false, type: 'recommended' as const })),
    ];

    // Get config from database
    const { data: configData, error: configError } = await supabase
      .from('m365_global_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching config from database:', configError);
    }

    // Use database config if available, fallback to env vars for backwards compatibility
    let appId = configData?.app_id || Deno.env.get('M365_MULTI_TENANT_APP_ID');
    let clientSecret = configData ? decryptSecret(configData.client_secret_encrypted) : Deno.env.get('M365_MULTI_TENANT_CLIENT_SECRET');

    // Validate if app_id is a proper GUID format
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidAppId = appId && guidRegex.test(appId);
    const hasClientSecret = clientSecret && clientSecret.length > 10 && !clientSecret.includes('PLACEHOLDER');

    if (!isValidAppId) {
      return new Response(
        JSON.stringify({ 
          configured: false,
          app_id: null,
          has_client_secret: false,
          permissions: defaultPermissions,
          permissions_validated: false,
          message: 'M365 multi-tenant app not configured or invalid App ID format.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mask the client secret - show only first 6 characters
    let maskedSecret = '';
    if (hasClientSecret && clientSecret) {
      const visiblePart = clientSecret.substring(0, 6);
      const hiddenLength = clientSecret.length - 6;
      maskedSecret = visiblePart + '•'.repeat(Math.min(hiddenLength, 20));
    }

    // Validate permissions if requested and we have valid credentials
    let permissions = defaultPermissions;
    let permissionsValidated = false;

    if (shouldValidatePermissions && isValidAppId && hasClientSecret && tenantIdForValidation && appId && clientSecret) {
      console.log('Validating permissions for tenant:', tenantIdForValidation);
      permissions = await validatePermissions(tenantIdForValidation, appId, clientSecret);
      permissionsValidated = true;
    }

    // Return config with permissions status
    return new Response(
      JSON.stringify({
        configured: isValidAppId && hasClientSecret,
        app_id: appId,
        has_client_secret: hasClientSecret,
        masked_secret: maskedSecret,
        callback_url: `${supabaseUrl}/functions/v1/m365-oauth-callback`,
        permissions,
        permissions_validated: permissionsValidated,
        source: configData ? 'database' : 'env_vars',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting M365 config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
