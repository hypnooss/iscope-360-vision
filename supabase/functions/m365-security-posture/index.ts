import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tenant_record_id } = body;
    console.log('M365 Security Posture request:', tenant_record_id);

    if (!tenant_record_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_record_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('m365_tenants')
      .select('*')
      .eq('id', tenant_record_id)
      .single();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch global config
    const { data: config } = await supabase
      .from('m365_global_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ success: false, error: 'M365 config not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt secret
    const encrypted = config.client_secret_encrypted;
    let clientSecret = '';
    
    if (!encrypted.includes(':')) {
      try { clientSecret = atob(encrypted); } catch { clientSecret = encrypted; }
    } else {
      const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
      if (!keyHex) throw new Error('M365_ENCRYPTION_KEY not configured');
      
      const [ivHex, ciphertextHex] = encrypted.split(':');
      const fromHex = (h: string) => new Uint8Array(h.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
      const iv = fromHex(ivHex);
      const ciphertext = fromHex(ciphertextHex);
      const keyBytes = fromHex(keyHex);
      
      const key = await crypto.subtle.importKey('raw', keyBytes.buffer, { name: 'AES-GCM' }, false, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer }, key, ciphertext.buffer);
      clientSecret = new TextDecoder().decode(decrypted);
    }

    // Get access token
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.app_id,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Token error:', errText);
      return new Response(JSON.stringify({ success: false, error: 'Failed to get access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Access token obtained');

    // Fetch MFA status
    const mfaResponse = await fetch('https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=100', {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'ConsistencyLevel': 'eventual' },
    });

    const insights: any[] = [];
    const now = new Date().toISOString();

    if (mfaResponse.ok) {
      const mfaData = await mfaResponse.json();
      const users = mfaData.value || [];
      const noMfa = users.filter((u: any) => {
        const methods = u.methodsRegistered || [];
        return !methods.some((m: string) => ['microsoftAuthenticatorPush', 'softwareOneTimePasscode'].includes(m));
      });

      if (noMfa.length > 0) {
        insights.push({
          id: 'IDT-001', code: 'IDT-001', category: 'identities', product: 'entra_id', severity: 'high',
          titulo: 'Usuários sem MFA',
          descricaoExecutiva: `${noMfa.length} usuário(s) sem MFA.`,
          riscoTecnico: 'Contas vulneráveis a comprometimento.',
          impactoNegocio: 'Risco de acesso não autorizado.',
          scoreImpacto: 7, status: 'fail',
          evidencias: noMfa.slice(0, 10),
          affectedEntities: noMfa.slice(0, 10).map((u: any) => ({ id: u.id, displayName: u.userDisplayName || '', userPrincipalName: u.userPrincipalName })),
          affectedCount: noMfa.length,
          endpointUsado: '/reports/authenticationMethods/userRegistrationDetails',
          source: 'graph',
          remediacao: { productAfetado: 'entra_id', portalUrl: 'https://entra.microsoft.com', caminhoPortal: ['Protection', 'Authentication methods'], passosDetalhados: ['Habilite MFA'], referenciaDocumentacao: 'https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-getstarted' },
          detectedAt: now,
        });
      }
    }

    // Calculate score
    const penalty = insights.reduce((sum, i) => sum + (i.status === 'fail' ? 15 : 0), 0);
    const score = Math.max(0, 100 - penalty);
    const classification = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'attention' : 'critical';

    const failed = insights.filter(i => i.status === 'fail');
    const summary = { critical: 0, high: failed.length, medium: 0, low: 0, info: 0, total: failed.length };

    const categories = ['identities', 'auth_access', 'admin_privileges', 'apps_integrations', 'email_exchange', 'threats_activity'];
    const categoryLabels: Record<string, string> = {
      identities: 'Identidades', auth_access: 'Autenticação', admin_privileges: 'Privilégios',
      apps_integrations: 'Aplicações', email_exchange: 'Email', threats_activity: 'Ameaças',
    };
    
    const categoryBreakdown = categories.map(cat => ({
      category: cat,
      label: categoryLabels[cat],
      count: insights.filter(i => i.category === cat).length,
      failCount: insights.filter(i => i.category === cat && i.status === 'fail').length,
      score: 100 - insights.filter(i => i.category === cat && i.status === 'fail').length * 15,
      criticalCount: 0,
      highCount: insights.filter(i => i.category === cat && i.severity === 'high').length,
    }));

    console.log('Analysis complete:', { score, insightCount: insights.length });

    return new Response(JSON.stringify({
      success: true,
      score,
      classification,
      summary,
      categoryBreakdown,
      insights,
      tenant: { id: tenant.tenant_id, domain: tenant.tenant_domain || '', displayName: tenant.display_name },
      analyzedAt: now,
      analyzedPeriod: { from: new Date(Date.now() - 30*24*60*60*1000).toISOString(), to: now },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
