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
  'AuditLog.Read.All'
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Check for error from Microsoft
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
    if (error) {
      console.error('OAuth error from Microsoft:', error, errorDescription);
      const redirectUrl = url.searchParams.get('state') 
        ? JSON.parse(atob(url.searchParams.get('state')!)).redirect_url 
        : '/scope-m365/tenant-connection';
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirectUrl}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`,
        },
      });
    }

    // Get state parameter (contains our metadata)
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

    // Get multi-tenant app credentials from secrets
    const appId = Deno.env.get('M365_MULTI_TENANT_APP_ID');
    const clientSecret = Deno.env.get('M365_MULTI_TENANT_CLIENT_SECRET');

    if (!appId || !clientSecret) {
      throw new Error('Multi-tenant app credentials not configured');
    }

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

    // Test Graph API access and get tenant info
    console.log('Testing Graph API access...');
    const orgResponse = await fetch('https://graph.microsoft.com/v1.0/organization', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!orgResponse.ok) {
      const orgError = await orgResponse.text();
      console.error('Graph API error:', orgError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${redirect_url}?error=graph_access_failed&error_description=${encodeURIComponent('Failed to access Microsoft Graph API.')}`,
        },
      });
    }

    const orgData = await orgResponse.json();
    const tenantInfo = orgData.value?.[0];
    const displayName = tenantInfo?.displayName || null;
    const verifiedDomains = tenantInfo?.verifiedDomains || [];
    const primaryDomain = verifiedDomains.find((d: any) => d.isDefault)?.name || 
                          verifiedDomains[0]?.name || null;

    // Test permissions
    console.log('Testing permissions...');
    const permissionResults: { name: string; granted: boolean; required: boolean }[] = [];
    
    const permissionTests = [
      { permission: 'User.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/users?$top=1' },
      { permission: 'Directory.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/directoryRoles?$top=1' },
      { permission: 'Group.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/groups?$top=1' },
      { permission: 'Application.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/applications?$top=1' },
      { permission: 'AuditLog.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=1' },
    ];

    for (const test of permissionTests) {
      try {
        const testResponse = await fetch(test.endpoint, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        permissionResults.push({
          name: test.permission,
          granted: testResponse.ok,
          required: REQUIRED_PERMISSIONS.includes(test.permission),
        });
      } catch (err) {
        console.error(`Permission test failed for ${test.permission}:`, err);
        permissionResults.push({
          name: test.permission,
          granted: false,
          required: REQUIRED_PERMISSIONS.includes(test.permission),
        });
      }
    }

    const allPermissionsGranted = permissionResults
      .filter(p => p.required)
      .every(p => p.granted);

    const missingPermissions = permissionResults
      .filter(p => p.required && !p.granted)
      .map(p => p.name);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Store permission status
    for (const perm of permissionResults) {
      await supabase
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
          permissions_granted: permissionResults.filter(p => p.granted).map(p => p.name),
          permissions_missing: missingPermissions,
          tenant_display_name: displayName,
          tenant_domain: primaryDomain,
        },
      });

    // Redirect back to the app with success
    const successUrl = allPermissionsGranted
      ? `${redirect_url}?success=true&tenant_id=${tenant_record_id}`
      : `${redirect_url}?success=partial&tenant_id=${tenant_record_id}&missing=${encodeURIComponent(missingPermissions.join(','))}`;

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
        'Location': `/scope-m365/tenant-connection?error=callback_failed&error_description=${encodeURIComponent(errorMessage)}`,
      },
    });
  }
});
