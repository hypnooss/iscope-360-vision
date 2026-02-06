import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface M365Insight {
  id: string;
  code: string;
  category: string;
  product: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  titulo: string;
  descricaoExecutiva: string;
  riscoTecnico: string;
  impactoNegocio: string;
  scoreImpacto: number;
  status: 'pass' | 'fail';
  affectedCount: number;
  affectedEntities: Array<{ id: string; displayName: string }>;
  remediacao: {
    productAfetado: string;
    portalUrl: string;
    caminhoPortal: string[];
    passosDetalhados: string[];
  };
  detectedAt: string;
}

interface CollectorResult {
  insights: M365Insight[];
  errors: string[];
}

// ========== COLLECTORS ==========

async function collectIdentityInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  try {
    // IDT-001: Users without MFA
    const mfaRes = await fetch('https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999', {
      headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: 'eventual' },
    });

    if (mfaRes.ok) {
      const mfaData = await mfaRes.json();
      const users = mfaData.value || [];
      const noMfa = users.filter((u: any) => {
        const m = u.methodsRegistered || [];
        return !m.includes('microsoftAuthenticatorPush') && !m.includes('softwareOneTimePasscode') && !m.includes('phoneAuthentication');
      });

      insights.push({
        id: 'IDT-001', code: 'IDT-001', category: 'identities', product: 'entra_id',
        severity: noMfa.length > 10 ? 'critical' : noMfa.length > 0 ? 'high' : 'info',
        titulo: 'Status de MFA dos Usuários',
        descricaoExecutiva: noMfa.length > 0 
          ? `${noMfa.length} de ${users.length} usuário(s) sem MFA configurado.`
          : `Todos os ${users.length} usuários possuem MFA configurado.`,
        riscoTecnico: 'Contas sem MFA são vulneráveis a ataques de phishing e credential stuffing.',
        impactoNegocio: 'Acesso não autorizado pode resultar em vazamento de dados e comprometimento de sistemas.',
        scoreImpacto: noMfa.length > 0 ? 8 : 0,
        status: noMfa.length > 0 ? 'fail' : 'pass',
        affectedCount: noMfa.length,
        affectedEntities: noMfa.slice(0, 10).map((u: any) => ({ id: u.id, displayName: u.userDisplayName || u.userPrincipalName })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Authentication methods', 'Policies'],
          passosDetalhados: ['Acesse o portal Entra ID', 'Navegue até Protection > Authentication methods', 'Configure políticas de MFA obrigatório'],
        },
        detectedAt: now,
      });
    } else {
      errors.push(`IDT-001: ${mfaRes.status} ${mfaRes.statusText}`);
    }
  } catch (e) {
    errors.push(`IDT-001: ${String(e)}`);
  }

  return { insights, errors };
}

async function collectAdminInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  try {
    // Get Global Administrator role
    const rolesRes = await fetch("https://graph.microsoft.com/v1.0/directoryRoles?$filter=displayName eq 'Global Administrator'", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (rolesRes.ok) {
      const rolesData = await rolesRes.json();
      const gaRole = rolesData.value?.[0];

      if (gaRole) {
        // Get members of Global Admin role
        const membersRes = await fetch(`https://graph.microsoft.com/v1.0/directoryRoles/${gaRole.id}/members`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          const admins = membersData.value || [];

          // ADM-001: Too many Global Admins
          insights.push({
            id: 'ADM-001', code: 'ADM-001', category: 'admin_privileges', product: 'entra_id',
            severity: admins.length > 5 ? 'high' : admins.length > 8 ? 'critical' : 'info',
            titulo: 'Quantidade de Global Admins',
            descricaoExecutiva: admins.length > 5
              ? `${admins.length} Global Admins detectados. Recomendado: máximo 5.`
              : `${admins.length} Global Admin(s) - dentro do limite recomendado.`,
            riscoTecnico: 'Excesso de Global Admins aumenta a superfície de ataque e dificulta auditoria.',
            impactoNegocio: 'Maior risco de comprometimento de conta privilegiada.',
            scoreImpacto: admins.length > 5 ? 6 : 0,
            status: admins.length > 5 ? 'fail' : 'pass',
            affectedCount: admins.length,
            affectedEntities: admins.slice(0, 10).map((a: any) => ({ id: a.id, displayName: a.displayName || a.userPrincipalName })),
            remediacao: {
              productAfetado: 'entra_id',
              portalUrl: 'https://entra.microsoft.com',
              caminhoPortal: ['Identity', 'Roles and administrators', 'Global Administrator'],
              passosDetalhados: ['Revise a lista de Global Admins', 'Remova acessos desnecessários', 'Use roles mais específicos (PIM)'],
            },
            detectedAt: now,
          });

          // ADM-002: Check MFA status for admins
          try {
            const mfaRes = await fetch('https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999', {
              headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: 'eventual' },
            });

            if (mfaRes.ok) {
              const mfaData = await mfaRes.json();
              const mfaUsers = mfaData.value || [];
              const mfaMap = new Map(mfaUsers.map((u: any) => [u.id, u]));

              const adminsWithoutMfa = admins.filter((admin: any) => {
                const mfaInfo = mfaMap.get(admin.id) as any;
                if (!mfaInfo) return true;
                const m = mfaInfo.methodsRegistered || [];
                return !m.includes('microsoftAuthenticatorPush') && !m.includes('softwareOneTimePasscode');
              });

              insights.push({
                id: 'ADM-002', code: 'ADM-002', category: 'admin_privileges', product: 'entra_id',
                severity: adminsWithoutMfa.length > 0 ? 'critical' : 'info',
                titulo: 'MFA em Contas de Global Admin',
                descricaoExecutiva: adminsWithoutMfa.length > 0
                  ? `${adminsWithoutMfa.length} Global Admin(s) sem MFA configurado!`
                  : 'Todos os Global Admins possuem MFA.',
                riscoTecnico: 'Contas administrativas sem MFA são alvos prioritários de ataques.',
                impactoNegocio: 'Comprometimento de admin pode resultar em controle total do tenant.',
                scoreImpacto: adminsWithoutMfa.length > 0 ? 10 : 0,
                status: adminsWithoutMfa.length > 0 ? 'fail' : 'pass',
                affectedCount: adminsWithoutMfa.length,
                affectedEntities: adminsWithoutMfa.slice(0, 10).map((a: any) => ({ id: a.id, displayName: a.displayName })),
                remediacao: {
                  productAfetado: 'entra_id',
                  portalUrl: 'https://entra.microsoft.com',
                  caminhoPortal: ['Protection', 'Conditional Access', 'Require MFA for admins'],
                  passosDetalhados: ['Crie política de Conditional Access', 'Exija MFA para todas as roles administrativas'],
                },
                detectedAt: now,
              });
            }
          } catch (e) {
            errors.push(`ADM-002: ${String(e)}`);
          }
        }
      }
    } else {
      errors.push(`ADM-001: ${rolesRes.status} ${rolesRes.statusText}`);
    }
  } catch (e) {
    errors.push(`ADM: ${String(e)}`);
  }

  return { insights, errors };
}

async function collectAuthInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  try {
    // AUT-001: Security Defaults
    const secRes = await fetch('https://graph.microsoft.com/v1.0/policies/identitySecurityDefaultsEnforcementPolicy', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (secRes.ok) {
      const secData = await secRes.json();
      const isEnabled = secData.isEnabled === true;

      insights.push({
        id: 'AUT-001', code: 'AUT-001', category: 'auth_access', product: 'entra_id',
        severity: !isEnabled ? 'medium' : 'info',
        titulo: 'Security Defaults',
        descricaoExecutiva: isEnabled
          ? 'Security Defaults está habilitado - proteções básicas ativas.'
          : 'Security Defaults está desabilitado. Verifique se Conditional Access está configurado.',
        riscoTecnico: 'Sem Security Defaults ou Conditional Access, o tenant fica sem proteções básicas.',
        impactoNegocio: 'Maior exposição a ataques comuns como password spray.',
        scoreImpacto: !isEnabled ? 4 : 0,
        status: isEnabled ? 'pass' : 'fail',
        affectedCount: isEnabled ? 0 : 1,
        affectedEntities: [],
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'Properties', 'Security defaults'],
          passosDetalhados: ['Avalie se Conditional Access está configurado', 'Se não, habilite Security Defaults'],
        },
        detectedAt: now,
      });
    } else {
      errors.push(`AUT-001: ${secRes.status} ${secRes.statusText}`);
    }
  } catch (e) {
    errors.push(`AUT-001: ${String(e)}`);
  }

  return { insights, errors };
}

async function collectAppsInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  try {
    // APP-001/002: Application credentials expiring/expired
    const appsRes = await fetch('https://graph.microsoft.com/v1.0/applications?$select=id,displayName,passwordCredentials,keyCredentials&$top=100', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (appsRes.ok) {
      const appsData = await appsRes.json();
      const apps = appsData.value || [];
      const nowDate = new Date();
      const thirtyDaysFromNow = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiredApps: any[] = [];
      const expiringApps: any[] = [];

      for (const app of apps) {
        const allCreds = [...(app.passwordCredentials || []), ...(app.keyCredentials || [])];
        for (const cred of allCreds) {
          if (cred.endDateTime) {
            const expDate = new Date(cred.endDateTime);
            if (expDate < nowDate) {
              expiredApps.push({ ...app, credExpiry: cred.endDateTime });
            } else if (expDate < thirtyDaysFromNow) {
              expiringApps.push({ ...app, credExpiry: cred.endDateTime });
            }
          }
        }
      }

      // APP-001: Expiring credentials
      insights.push({
        id: 'APP-001', code: 'APP-001', category: 'apps_integrations', product: 'entra_id',
        severity: expiringApps.length > 0 ? 'medium' : 'info',
        titulo: 'Credenciais Expirando em 30 dias',
        descricaoExecutiva: expiringApps.length > 0
          ? `${expiringApps.length} aplicação(ões) com credenciais expirando nos próximos 30 dias.`
          : 'Nenhuma credencial de aplicação expirando em breve.',
        riscoTecnico: 'Credenciais expiradas podem causar interrupção de serviços.',
        impactoNegocio: 'Integrações podem parar de funcionar sem aviso.',
        scoreImpacto: expiringApps.length > 0 ? 3 : 0,
        status: expiringApps.length > 0 ? 'fail' : 'pass',
        affectedCount: expiringApps.length,
        affectedEntities: expiringApps.slice(0, 10).map((a: any) => ({ id: a.id, displayName: `${a.displayName} (expira: ${new Date(a.credExpiry).toLocaleDateString('pt-BR')})` })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'App registrations', 'Certificates & secrets'],
          passosDetalhados: ['Acesse cada aplicação listada', 'Renove as credenciais antes da expiração'],
        },
        detectedAt: now,
      });

      // APP-002: Expired credentials
      insights.push({
        id: 'APP-002', code: 'APP-002', category: 'apps_integrations', product: 'entra_id',
        severity: expiredApps.length > 0 ? 'high' : 'info',
        titulo: 'Credenciais Expiradas',
        descricaoExecutiva: expiredApps.length > 0
          ? `${expiredApps.length} aplicação(ões) com credenciais já expiradas.`
          : 'Nenhuma credencial de aplicação expirada.',
        riscoTecnico: 'Aplicações com credenciais expiradas não funcionam e podem indicar apps abandonados.',
        impactoNegocio: 'Serviços dependentes podem estar indisponíveis.',
        scoreImpacto: expiredApps.length > 0 ? 5 : 0,
        status: expiredApps.length > 0 ? 'fail' : 'pass',
        affectedCount: expiredApps.length,
        affectedEntities: expiredApps.slice(0, 10).map((a: any) => ({ id: a.id, displayName: `${a.displayName} (expirou: ${new Date(a.credExpiry).toLocaleDateString('pt-BR')})` })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'App registrations'],
          passosDetalhados: ['Verifique se a aplicação ainda é necessária', 'Renove ou remova credenciais expiradas'],
        },
        detectedAt: now,
      });
    } else {
      errors.push(`APP: ${appsRes.status} ${appsRes.statusText}`);
    }
  } catch (e) {
    errors.push(`APP: ${String(e)}`);
  }

  return { insights, errors };
}

async function collectExchangeInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  try {
    // EXO-001: Check for external forwarding rules (sample of users)
    const usersRes = await fetch('https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail&$top=20', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (usersRes.ok) {
      const usersData = await usersRes.json();
      const users = usersData.value || [];
      const externalForwarding: any[] = [];

      // Check inbox rules for each user (limited sample)
      for (const user of users.slice(0, 10)) {
        try {
          const rulesRes = await fetch(`https://graph.microsoft.com/v1.0/users/${user.id}/mailFolders/inbox/messageRules`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (rulesRes.ok) {
            const rulesData = await rulesRes.json();
            const rules = rulesData.value || [];

            for (const rule of rules) {
              if (rule.actions?.forwardTo || rule.actions?.redirectTo) {
                const recipients = [...(rule.actions.forwardTo || []), ...(rule.actions.redirectTo || [])];
                const external = recipients.filter((r: any) => 
                  r.emailAddress?.address && !r.emailAddress.address.includes('@')
                );
                if (external.length > 0 || recipients.length > 0) {
                  externalForwarding.push({
                    userId: user.id,
                    userName: user.displayName,
                    ruleName: rule.displayName,
                    recipients: recipients.map((r: any) => r.emailAddress?.address).join(', '),
                  });
                }
              }
            }
          }
        } catch {
          // Individual user rule check failed, continue
        }
      }

      insights.push({
        id: 'EXO-001', code: 'EXO-001', category: 'email_exchange', product: 'exchange',
        severity: externalForwarding.length > 0 ? 'high' : 'info',
        titulo: 'Regras de Redirecionamento de Email',
        descricaoExecutiva: externalForwarding.length > 0
          ? `${externalForwarding.length} regra(s) de redirecionamento detectada(s) (amostra de ${Math.min(10, users.length)} usuários).`
          : 'Nenhuma regra de redirecionamento suspeita detectada na amostra.',
        riscoTecnico: 'Regras de forwarding podem exfiltrar dados sensíveis automaticamente.',
        impactoNegocio: 'Vazamento de informações confidenciais sem conhecimento do usuário.',
        scoreImpacto: externalForwarding.length > 0 ? 7 : 0,
        status: externalForwarding.length > 0 ? 'fail' : 'pass',
        affectedCount: externalForwarding.length,
        affectedEntities: externalForwarding.slice(0, 10).map((f: any) => ({ 
          id: f.userId, 
          displayName: `${f.userName}: ${f.ruleName} → ${f.recipients}` 
        })),
        remediacao: {
          productAfetado: 'exchange',
          portalUrl: 'https://admin.exchange.microsoft.com',
          caminhoPortal: ['Mail flow', 'Rules'],
          passosDetalhados: ['Revise as regras de forwarding detectadas', 'Confirme com os usuários se são legítimas', 'Remova regras suspeitas'],
        },
        detectedAt: now,
      });
    } else {
      errors.push(`EXO-001: ${usersRes.status} ${usersRes.statusText}`);
    }
  } catch (e) {
    errors.push(`EXO-001: ${String(e)}`);
  }

  return { insights, errors };
}

// ========== MAIN HANDLER ==========

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

    console.log(`[m365-security-posture] Starting analysis for tenant: ${tenant_record_id}`);

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

    // Decrypt client secret
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

    // Get access token
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${config.app_id}&client_secret=${encodeURIComponent(secret)}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials`,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[m365-security-posture] Token failed: ${errText}`);
      return new Response(JSON.stringify({ success: false, error: 'Token failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { access_token } = await tokenRes.json();
    const now = new Date().toISOString();

    console.log(`[m365-security-posture] Running collectors in parallel...`);

    // Run all collectors in parallel
    const results = await Promise.allSettled([
      collectIdentityInsights(access_token, now),
      collectAdminInsights(access_token, now),
      collectAuthInsights(access_token, now),
      collectAppsInsights(access_token, now),
      collectExchangeInsights(access_token, now),
    ]);

    // Consolidate results
    const allInsights: M365Insight[] = [];
    const allErrors: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allInsights.push(...result.value.insights);
        allErrors.push(...result.value.errors);
      } else {
        allErrors.push(String(result.reason));
      }
    }

    console.log(`[m365-security-posture] Collected ${allInsights.length} insights, ${allErrors.length} errors`);

    // Calculate category scores
    const categories = ['identities', 'auth_access', 'admin_privileges', 'apps_integrations', 'email_exchange', 'threats_activity'];
    const categoryLabels: Record<string, string> = {
      identities: 'Identidades',
      auth_access: 'Autenticação',
      admin_privileges: 'Privilégios Admin',
      apps_integrations: 'Aplicações',
      email_exchange: 'Email/Exchange',
      threats_activity: 'Ameaças',
    };

    const categoryBreakdown = categories.map(cat => {
      const catInsights = allInsights.filter(i => i.category === cat);
      const failCount = catInsights.filter(i => i.status === 'fail').length;
      const totalPenalty = catInsights.reduce((sum, i) => sum + (i.status === 'fail' ? i.scoreImpacto : 0), 0);
      const criticalCount = catInsights.filter(i => i.status === 'fail' && i.severity === 'critical').length;
      const highCount = catInsights.filter(i => i.status === 'fail' && i.severity === 'high').length;

      return {
        category: cat,
        label: categoryLabels[cat] || cat,
        count: catInsights.length,
        failCount,
        score: Math.max(0, 100 - totalPenalty * 5),
        criticalCount,
        highCount,
      };
    });

    // Calculate overall score
    const totalPenalty = allInsights.reduce((sum, i) => sum + (i.status === 'fail' ? i.scoreImpacto : 0), 0);
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));
    const classification = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'attention' : 'critical';

    // Calculate summary
    const failedInsights = allInsights.filter(i => i.status === 'fail');
    const summary = {
      critical: failedInsights.filter(i => i.severity === 'critical').length,
      high: failedInsights.filter(i => i.severity === 'high').length,
      medium: failedInsights.filter(i => i.severity === 'medium').length,
      low: failedInsights.filter(i => i.severity === 'low').length,
      info: allInsights.filter(i => i.severity === 'info').length,
      total: allInsights.length,
    };

    console.log(`[m365-security-posture] Score: ${score}, Classification: ${classification}`);

    return new Response(JSON.stringify({
      success: true,
      score,
      classification,
      summary,
      categoryBreakdown,
      insights: allInsights,
      errors: allErrors.length > 0 ? allErrors : undefined,
      tenant: { 
        id: tenant.tenant_id, 
        domain: tenant.tenant_domain || '', 
        displayName: tenant.display_name 
      },
      analyzedAt: now,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(`[m365-security-posture] Error: ${String(e)}`);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
