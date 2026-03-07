import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tenant_record_id } = await req.json();
    if (!tenant_record_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_record_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[m365-service-health] Fetching service health for tenant: ${tenant_record_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load tenant
    const { data: tenant } = await supabase
      .from('m365_tenants')
      .select('*')
      .eq('id', tenant_record_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load global config
    const { data: config } = await supabase
      .from('m365_global_config')
      .select('*')
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ success: false, error: 'Config not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Decrypt client secret
    const enc = config.client_secret_encrypted;
    let secret = '';
    if (!enc.includes(':')) {
      secret = atob(enc);
    } else {
      const keyHex = Deno.env.get('M365_ENCRYPTION_KEY') ?? '';
      const [ivH, ctH] = enc.split(':');
      const hex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map(b => parseInt(b, 16)));
      const key = await crypto.subtle.importKey('raw', hex(keyHex), { name: 'AES-GCM' }, false, ['decrypt']);
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hex(ivH) }, key, hex(ctH));
      secret = new TextDecoder().decode(dec);
    }

    // 4. Get access token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${config.app_id}&client_secret=${encodeURIComponent(secret)}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[m365-service-health] Token failed: ${errText}`);
      return new Response(JSON.stringify({ success: false, error: 'Token acquisition failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token } = await tokenRes.json();

    // 5. Fetch service health data in parallel
    const graphHeaders = {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    };

    const [healthRes, issuesRes] = await Promise.all([
      fetch('https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews', { headers: graphHeaders }),
      fetch('https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues?$top=100&$orderby=lastModifiedDateTime desc', { headers: graphHeaders }),
    ]);

    let services: any[] = [];
    let issues: any[] = [];

    if (healthRes.ok) {
      const healthData = await healthRes.json();
      services = (healthData.value || []).map((s: any) => ({
        id: s.id,
        service: s.service,
        status: s.status,
      }));
    } else {
      const errText = await healthRes.text();
      console.error(`[m365-service-health] Health overviews failed: ${errText}`);
    }

    if (issuesRes.ok) {
      const issuesData = await issuesRes.json();
      issues = (issuesData.value || []).map((i: any) => ({
        id: i.id,
        title: i.title,
        service: i.service,
        status: i.status,
        classification: i.classification,
        origin: i.origin,
        startDateTime: i.startDateTime,
        endDateTime: i.endDateTime,
        lastModifiedDateTime: i.lastModifiedDateTime,
        isResolved: i.isResolved,
        impactDescription: i.impactDescription,
        featureGroup: i.featureGroup,
        feature: i.feature,
        posts: (i.posts || []).map((p: any) => ({
          createdDateTime: p.createdDateTime,
          content: p.content?.content || '',
          contentType: p.content?.contentType || 'text',
        })),
      }));
    } else {
      const errText = await issuesRes.text();
      console.error(`[m365-service-health] Issues failed: ${errText}`);
    }

    console.log(`[m365-service-health] Loaded ${services.length} services, ${issues.length} issues`);

    return new Response(JSON.stringify({ success: true, services, issues }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(`[m365-service-health] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
