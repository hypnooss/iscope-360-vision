import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface WhoisResult {
  registrar: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function extractFromRdap(data: any): WhoisResult {
  const result: WhoisResult = {
    registrar: null,
    expiresAt: null,
    createdAt: null,
    updatedAt: null,
  };

  // Extract dates from events
  const events = data.events || [];
  for (const event of events) {
    const action = event.eventAction;
    const date = event.eventDate;
    if (!date) continue;

    if (action === 'expiration') result.expiresAt = date;
    else if (action === 'registration') result.createdAt = date;
    else if (action === 'last changed') result.updatedAt = date;
  }

  // Extract registrar from entities
  const entities = data.entities || [];
  for (const entity of entities) {
    const roles = entity.roles || [];
    if (roles.includes('registrar')) {
      result.registrar = entity.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]
        || entity.handle
        || entity.publicIds?.[0]?.identifier
        || null;
      break;
    }
  }

  return result;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { domain, domain_id } = await req.json();

    if (!domain) {
      return new Response(JSON.stringify({ error: 'domain is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabaseUser.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[domain-whois-lookup] Looking up RDAP for: ${domain}`);

    // Determine RDAP endpoint
    const isBr = domain.endsWith('.br');
    const rdapUrl = isBr
      ? `https://rdap.registro.br/domain/${encodeURIComponent(domain)}`
      : `https://rdap.org/domain/${encodeURIComponent(domain)}`;

    const rdapRes = await fetch(rdapUrl, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!rdapRes.ok) {
      const errText = await rdapRes.text();
      console.error(`[domain-whois-lookup] RDAP failed (${rdapRes.status}): ${errText}`);
      return new Response(JSON.stringify({
        success: false,
        error: `RDAP lookup failed: ${rdapRes.status}`,
        domain,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rdapData = await rdapRes.json();
    const whois = extractFromRdap(rdapData);

    console.log(`[domain-whois-lookup] Result for ${domain}: registrar=${whois.registrar}, expires=${whois.expiresAt}`);

    // If domain_id provided, update the record
    if (domain_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: updateError } = await supabase
        .from('external_domains')
        .update({
          whois_registrar: whois.registrar,
          whois_expires_at: whois.expiresAt,
          whois_created_at: whois.createdAt,
          whois_checked_at: new Date().toISOString(),
        })
        .eq('id', domain_id);

      if (updateError) {
        console.error(`[domain-whois-lookup] Failed to update domain ${domain_id}:`, updateError);
      } else {
        console.log(`[domain-whois-lookup] Updated domain ${domain_id} with WHOIS data`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      domain,
      ...whois,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[domain-whois-lookup] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
