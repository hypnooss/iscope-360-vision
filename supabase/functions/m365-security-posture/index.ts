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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tenant } = await supabase.from('m365_tenants').select('*').eq('id', tenant_record_id).single();
    if (!tenant) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase.from('m365_global_config').select('*').limit(1).single();
    if (!config) {
      return new Response(JSON.stringify({ success: false, error: 'Config not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt
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

    // Token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${config.app_id}&client_secret=${encodeURIComponent(secret)}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
    });
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Token failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { access_token } = await tokenRes.json();

    // Check MFA
    const mfaRes = await fetch('https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=100', {
      headers: { Authorization: `Bearer ${access_token}`, ConsistencyLevel: 'eventual' },
    });

    const insights: any[] = [];
    const now = new Date().toISOString();

    if (mfaRes.ok) {
      const mfaData = await mfaRes.json();
      const noMfa = (mfaData.value || []).filter((u: any) => {
        const m = u.methodsRegistered || [];
        return !m.includes('microsoftAuthenticatorPush') && !m.includes('softwareOneTimePasscode');
      });
      if (noMfa.length > 0) {
        insights.push({
          id: 'IDT-001', code: 'IDT-001', category: 'identities', product: 'entra_id', severity: 'high',
          titulo: 'Usuários sem MFA', descricaoExecutiva: `${noMfa.length} usuário(s) sem MFA.`,
          riscoTecnico: 'Contas vulneráveis.', impactoNegocio: 'Risco de acesso não autorizado.',
          scoreImpacto: 7, status: 'fail', affectedCount: noMfa.length,
          affectedEntities: noMfa.slice(0, 5).map((u: any) => ({ id: u.id, displayName: u.userDisplayName })),
          remediacao: { productAfetado: 'entra_id', portalUrl: 'https://entra.microsoft.com', caminhoPortal: ['Protection', 'Authentication methods'], passosDetalhados: ['Habilite MFA'] },
          detectedAt: now,
        });
      }
    }

    const penalty = insights.reduce((s, i) => s + (i.status === 'fail' ? 15 : 0), 0);
    const score = Math.max(0, 100 - penalty);
    const classification = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'attention' : 'critical';

    return new Response(JSON.stringify({
      success: true, score, classification,
      summary: { critical: 0, high: insights.filter(i => i.status === 'fail').length, medium: 0, low: 0, info: 0, total: insights.length },
      categoryBreakdown: [
        { category: 'identities', label: 'Identidades', count: insights.filter(i => i.category === 'identities').length, failCount: insights.filter(i => i.category === 'identities' && i.status === 'fail').length, score: 100 - insights.filter(i => i.category === 'identities' && i.status === 'fail').length * 15 },
        { category: 'auth_access', label: 'Autenticação', count: 0, failCount: 0, score: 100 },
        { category: 'admin_privileges', label: 'Privilégios', count: 0, failCount: 0, score: 100 },
        { category: 'apps_integrations', label: 'Aplicações', count: 0, failCount: 0, score: 100 },
        { category: 'email_exchange', label: 'Email', count: 0, failCount: 0, score: 100 },
        { category: 'threats_activity', label: 'Ameaças', count: 0, failCount: 0, score: 100 },
      ],
      insights,
      tenant: { id: tenant.tenant_id, domain: tenant.tenant_domain || '', displayName: tenant.display_name },
      analyzedAt: now,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});