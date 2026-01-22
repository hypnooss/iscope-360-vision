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

    // Verify user is authenticated and is super_admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Super admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { app_id, client_secret } = body;

    if (!app_id) {
      return new Response(
        JSON.stringify({ error: 'app_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate app_id format (GUID)
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(app_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid app_id format. Must be a valid GUID.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if config already exists
    const { data: existingConfig, error: fetchError } = await supabase
      .from('m365_global_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing config:', fetchError);
      throw fetchError;
    }

    // Simple encryption for the client secret (in production, use proper encryption)
    // For now, we'll use base64 encoding as a basic obfuscation
    const encryptSecret = (secret: string): string => {
      return btoa(secret);
    };

    let result;
    if (existingConfig) {
      // Update existing config
      const updateData: Record<string, unknown> = {
        app_id,
        updated_by: user.id,
      };
      
      // Only update client_secret if provided
      if (client_secret) {
        updateData.client_secret_encrypted = encryptSecret(client_secret);
      }

      const { data, error } = await supabase
        .from('m365_global_config')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating config:', error);
        throw error;
      }
      result = data;
    } else {
      // Create new config - require client_secret for initial setup
      if (!client_secret) {
        return new Response(
          JSON.stringify({ error: 'client_secret is required for initial configuration' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('m365_global_config')
        .insert({
          app_id,
          client_secret_encrypted: encryptSecret(client_secret),
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating config:', error);
        throw error;
      }
      result = data;
    }

    // Log the configuration update (for audit purposes)
    await supabase.from('admin_activity_logs').insert({
      admin_id: user.id,
      action: existingConfig ? 'update_m365_config' : 'create_m365_config',
      action_type: 'configuration',
      target_type: 'system_config',
      target_name: 'M365 Multi-Tenant Configuration',
      details: {
        app_id_updated: true,
        client_secret_updated: !!client_secret,
        config_id: result.id,
      },
    });

    console.log('M365 config saved successfully:', { configId: result.id, userId: user.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Configuration saved successfully.',
        config_id: result.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating M365 config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
