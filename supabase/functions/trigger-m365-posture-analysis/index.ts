import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub;

    // Parse body
    const body = await req.json();
    const { tenant_record_id } = body;

    if (!tenant_record_id) {
      return new Response(JSON.stringify({ error: 'tenant_record_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[trigger-m365-posture-analysis] Starting analysis for tenant: ${tenant_record_id}, user: ${userId}`);

    // Get tenant details
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .select('id, tenant_id, tenant_domain, display_name, client_id')
      .eq('id', tenant_record_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('[trigger-m365-posture-analysis] Tenant not found:', tenantError);
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for pending/running analysis
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: pendingAnalysis } = await supabaseAdmin
      .from('m365_posture_history')
      .select('id, status, created_at')
      .eq('tenant_record_id', tenant_record_id)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingAnalysis) {
      console.log(`[trigger-m365-posture-analysis] Analysis already in progress: ${pendingAnalysis.id}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Analysis already in progress',
        existing_id: pendingAnalysis.id,
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create pending record
    const { data: historyRecord, error: insertError } = await supabaseAdmin
      .from('m365_posture_history')
      .insert({
        tenant_record_id,
        client_id: tenant.client_id,
        status: 'pending',
        analyzed_by: userId,
      })
      .select('id')
      .single();

    if (insertError || !historyRecord) {
      console.error('[trigger-m365-posture-analysis] Failed to create history record:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create analysis record' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[trigger-m365-posture-analysis] Created pending record: ${historyRecord.id}`);

    // Start background analysis using EdgeRuntime.waitUntil
    const runAnalysis = async () => {
      try {
        // Update status to running
        await supabaseAdmin
          .from('m365_posture_history')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', historyRecord.id);

        console.log(`[trigger-m365-posture-analysis] Starting m365-security-posture call...`);

        // Call the main analysis function
        const res = await fetch(`${supabaseUrl}/functions/v1/m365-security-posture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ tenant_record_id }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`[trigger-m365-posture-analysis] Analysis failed: ${res.status} ${errorText}`);
          
          await supabaseAdmin
            .from('m365_posture_history')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              errors: { message: `Analysis failed: ${res.status}`, details: errorText },
            })
            .eq('id', historyRecord.id);
          return;
        }

        const result = await res.json();
        console.log(`[trigger-m365-posture-analysis] Analysis completed. Score: ${result.score}`);

        // Update history record with results
        await supabaseAdmin
          .from('m365_posture_history')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            score: result.score,
            classification: result.classification,
            summary: result.summary,
            category_breakdown: result.categoryBreakdown,
            insights: result.insights,
            errors: result.errors ? { errors: result.errors } : null,
          })
          .eq('id', historyRecord.id);

        console.log(`[trigger-m365-posture-analysis] Record ${historyRecord.id} updated successfully`);

      } catch (e) {
        console.error(`[trigger-m365-posture-analysis] Background error:`, e);
        
        await supabaseAdmin
          .from('m365_posture_history')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors: { message: String(e) },
          })
          .eq('id', historyRecord.id);
      }
    };

    // Run analysis in background
    EdgeRuntime.waitUntil(runAnalysis());

    // Return immediately with the job ID
    return new Response(JSON.stringify({
      success: true,
      message: 'Analysis started',
      analysis_id: historyRecord.id,
      tenant: {
        id: tenant.tenant_id,
        domain: tenant.tenant_domain,
        displayName: tenant.display_name,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(`[trigger-m365-posture-analysis] Error:`, e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
