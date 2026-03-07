import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ====== Helpers ======

function hex(h: string): Uint8Array {
  return new Uint8Array(h.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

async function decryptSecret(encrypted: string): Promise<string> {
  if (!encrypted.includes(':')) return atob(encrypted);
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY') ?? '';
  const [ivH, ctH] = encrypted.split(':');
  const key = await crypto.subtle.importKey('raw', hex(keyHex), { name: 'AES-GCM' }, false, ['decrypt']);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hex(ivH) }, key, hex(ctH));
  return new TextDecoder().decode(dec);
}

async function requestGraphToken(tenantId: string, appId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${appId}&client_secret=${encodeURIComponent(clientSecret)}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
    });
    if (!res.ok) {
      console.error(`[m365-service-health] Token failed for tenant ${tenantId}: ${await res.text()}`);
      return null;
    }
    const { access_token } = await res.json();
    return access_token || null;
  } catch (err) {
    console.error(`[m365-service-health] Token error:`, err);
    return null;
  }
}

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

    console.log(`[m365-service-health] Fetching for tenant: ${tenant_record_id}`);

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

    // 2. Try per-tenant credentials first
    let access_token: string | null = null;

    const { data: cred } = await supabase
      .from('m365_app_credentials')
      .select('*')
      .eq('tenant_record_id', tenant_record_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (cred?.client_secret_encrypted) {
      console.log(`[m365-service-health] Trying per-tenant credentials (app: ${cred.azure_app_id})`);
      const secret = await decryptSecret(cred.client_secret_encrypted);
      access_token = await requestGraphToken(tenant.tenant_id, cred.azure_app_id, secret);
    }

    // 3. Fallback to global config
    if (!access_token) {
      console.log(`[m365-service-health] Falling back to global config`);
      const { data: config } = await supabase
        .from('m365_global_config')
        .select('*')
        .limit(1)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ success: false, error: 'No credentials available' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const secret = await decryptSecret(config.client_secret_encrypted);
      access_token = await requestGraphToken(tenant.tenant_id, config.app_id, secret);
    }

    if (!access_token) {
      return new Response(JSON.stringify({ success: false, error: 'Token acquisition failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch service health data in parallel
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
