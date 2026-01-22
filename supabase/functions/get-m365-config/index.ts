import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get the multi-tenant app ID (not the secret - that stays server-side)
    const appId = Deno.env.get('M365_MULTI_TENANT_APP_ID');
    const clientSecret = Deno.env.get('M365_MULTI_TENANT_CLIENT_SECRET');

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

    // Return only the app ID and masked secret
    return new Response(
      JSON.stringify({
        configured: true,
        app_id: appId,
        has_client_secret: hasClientSecret,
        masked_secret: maskedSecret,
        callback_url: `${supabaseUrl}/functions/v1/m365-oauth-callback`,
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
