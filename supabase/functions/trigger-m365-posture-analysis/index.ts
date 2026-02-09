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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[trigger-m365-posture-analysis] Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    // Parse body
    const body = await req.json();
    const { tenant_record_id, scope } = body;

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

    // Check if tenant has linked agent for PowerShell-based collection
    let agentTaskId: string | null = null;
    const { data: tenantAgent } = await supabaseAdmin
      .from('m365_tenant_agents')
      .select('agent_id')
      .eq('tenant_record_id', tenant_record_id)
      .eq('enabled', true)
      .maybeSingle();

    if (tenantAgent?.agent_id) {
      console.log(`[trigger-m365-posture-analysis] Tenant has linked agent: ${tenantAgent.agent_id}`);
      
      // Create agent task for PowerShell-based collection (Exchange, SharePoint)
      const { data: agentTask, error: agentTaskError } = await supabaseAdmin
        .from('agent_tasks')
        .insert({
          agent_id: tenantAgent.agent_id,
          task_type: 'm365_powershell',
          target_id: tenant_record_id,
          target_type: 'm365_tenant',
          status: 'pending',
          priority: 5,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          payload: {
            analysis_id: historyRecord.id,
            tenant_id: tenant.tenant_id,
            tenant_domain: tenant.tenant_domain,
            ...(scope ? { scope } : {}),
          },
        })
        .select('id')
        .single();

      if (agentTaskError) {
        console.error('[trigger-m365-posture-analysis] Failed to create agent task:', agentTaskError);
        // Don't fail the whole operation - Graph API analysis can still proceed
      } else {
        agentTaskId = agentTask?.id || null;
        console.log(`[trigger-m365-posture-analysis] Agent task created: ${agentTaskId}`);
        
        // Link agent task to the posture history record
        await supabaseAdmin
          .from('m365_posture_history')
          .update({ 
            agent_task_id: agentTaskId,
            agent_status: 'pending',
          })
          .eq('id', historyRecord.id);
      }
    } else {
      console.log(`[trigger-m365-posture-analysis] No agent linked to tenant, skipping PowerShell collection`);
    }

    // Start background analysis using EdgeRuntime.waitUntil (Graph API)
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
          body: JSON.stringify({ tenant_record_id, ...(scope ? { blueprint_filter: scope } : {}) }),
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

        let allInsights = result.insights || [];

        // When scope is exchange_online, also call exchange-online-insights for inbox rules analysis
        if (scope === 'exchange_online') {
          try {
            console.log(`[trigger-m365-posture-analysis] Calling exchange-online-insights for scoped analysis...`);
            const exoRes = await fetch(`${supabaseUrl}/functions/v1/exchange-online-insights`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ tenant_record_id }),
            });

            if (exoRes.ok) {
              const exoResult = await exoRes.json();
              const exoInsights = (exoResult.insights || []).map((i: any) => ({
                ...i,
                product: 'exchange_online',
                category: i.category || 'email_exchange',
              }));
              allInsights = [...allInsights, ...exoInsights];
              console.log(`[trigger-m365-posture-analysis] Merged ${exoInsights.length} exchange-online-insights`);
            } else {
              console.error(`[trigger-m365-posture-analysis] exchange-online-insights failed: ${exoRes.status}`);
            }
          } catch (exoErr) {
            console.error(`[trigger-m365-posture-analysis] exchange-online-insights error:`, exoErr);
          }
        }

        // Recalculate summary with ALL insights (API + Exchange)
        const recalculatedSummary = {
          critical: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'critical').length,
          high: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'high').length,
          medium: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'medium').length,
          low: allInsights.filter((i: any) => i.status === 'fail' && i.severity === 'low').length,
          info: allInsights.filter((i: any) => i.severity === 'info').length,
          total: allInsights.length,
        };

        // Update history record with results
        await supabaseAdmin
          .from('m365_posture_history')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            score: result.score,
            classification: result.classification,
            summary: recalculatedSummary,
            category_breakdown: result.categoryBreakdown,
            insights: allInsights,
            environment_metrics: result.environmentMetrics || null,
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
      agent_task_id: agentTaskId,
      has_agent: !!tenantAgent?.agent_id,
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
