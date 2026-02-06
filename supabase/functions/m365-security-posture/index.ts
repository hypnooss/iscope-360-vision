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
  affectedEntities: Array<{ id: string; displayName: string; details?: Record<string, unknown> }>;
  remediacao: {
    productAfetado: string;
    portalUrl: string;
    caminhoPortal: string[];
    passosDetalhados: string[];
  };
  detectedAt: string;
  endpointUsado?: string;
}

interface CollectorResult {
  insights: M365Insight[];
  errors: string[];
}

// ========== HELPER FUNCTIONS ==========

async function graphFetch(accessToken: string, endpoint: string, options: { consistency?: boolean; beta?: boolean } = {}): Promise<any> {
  const baseUrl = options.beta ? 'https://graph.microsoft.com/beta' : 'https://graph.microsoft.com/v1.0';
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (options.consistency) {
    headers['ConsistencyLevel'] = 'eventual';
  }
  
  const res = await fetch(`${baseUrl}${endpoint}`, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function graphFetchSafe(accessToken: string, endpoint: string, options: { consistency?: boolean; beta?: boolean } = {}): Promise<{ data: any; error: string | null }> {
  try {
    const data = await graphFetch(accessToken, endpoint, options);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ========== ENVIRONMENT METRICS ==========

interface EnvironmentMetrics {
  authType: 'cloud_only' | 'hybrid' | 'federated';
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  guestUsers: number;
  mfaEnabledPercent: number;
  conditionalAccessEnabled: boolean;
  conditionalAccessPoliciesCount: number;
  securityDefaultsEnabled: boolean;
  enterpriseAppsCount: number;
  appRegistrationsCount: number;
  storageUsedGB: number;
  storageTotalGB: number;
  loginCountries: Array<{ country: string; success: number; fail: number }>;
}

async function collectEnvironmentMetrics(accessToken: string): Promise<EnvironmentMetrics> {
  const metrics: EnvironmentMetrics = {
    authType: 'cloud_only',
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    guestUsers: 0,
    mfaEnabledPercent: 0,
    conditionalAccessEnabled: false,
    conditionalAccessPoliciesCount: 0,
    securityDefaultsEnabled: false,
    enterpriseAppsCount: 0,
    appRegistrationsCount: 0,
    storageUsedGB: 0,
    storageTotalGB: 0,
    loginCountries: [],
  };

  console.log('[collectEnvironmentMetrics] Starting collection...');

  // 1. Organization info (detect Hybrid/Federation)
  try {
    const { data: orgData } = await graphFetchSafe(accessToken, '/organization');
    if (orgData?.value?.[0]) {
      const org = orgData.value[0];
      if (org.onPremisesSyncEnabled) {
        metrics.authType = 'hybrid';
        console.log('[collectEnvironmentMetrics] Detected hybrid auth (AD Connect)');
      }
      // Check for federation via verified domains
      const { data: domainsData } = await graphFetchSafe(accessToken, '/domains');
      if (domainsData?.value) {
        const federated = domainsData.value.some((d: any) => d.authenticationType === 'Federated');
        if (federated) {
          metrics.authType = 'federated';
          console.log('[collectEnvironmentMetrics] Detected federated auth');
        }
      }
    }
  } catch (e) {
    console.error('[collectEnvironmentMetrics] Organization check failed:', e);
  }

  // 2. User counts
  try {
    // Total users
    const { data: totalCount } = await graphFetchSafe(accessToken, '/users/$count', { consistency: true });
    metrics.totalUsers = typeof totalCount === 'number' ? totalCount : 0;
    console.log(`[collectEnvironmentMetrics] Total users: ${metrics.totalUsers}`);

    // Active users
    const { data: activeCount } = await graphFetchSafe(accessToken, '/users/$count?$filter=accountEnabled eq true', { consistency: true });
    metrics.activeUsers = typeof activeCount === 'number' ? activeCount : 0;

    // Guest users
    const { data: guestCount } = await graphFetchSafe(accessToken, "/users/$count?$filter=userType eq 'Guest'", { consistency: true });
    metrics.guestUsers = typeof guestCount === 'number' ? guestCount : 0;

    // Disabled = total - active
    metrics.disabledUsers = Math.max(0, metrics.totalUsers - metrics.activeUsers);
  } catch (e) {
    console.error('[collectEnvironmentMetrics] User count failed:', e);
  }

  // 3. MFA Status (from authentication methods report)
  try {
    const { data: mfaData } = await graphFetchSafe(accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999', { consistency: true });
    if (mfaData?.value) {
      const users = mfaData.value;
      const withMfa = users.filter((u: any) => {
        const methods = u.methodsRegistered || [];
        return methods.includes('microsoftAuthenticatorPush') || 
               methods.includes('softwareOneTimePasscode') || 
               methods.includes('phoneAuthentication');
      });
      metrics.mfaEnabledPercent = users.length > 0 
        ? Math.round((withMfa.length / users.length) * 100) 
        : 0;
      console.log(`[collectEnvironmentMetrics] MFA enabled: ${metrics.mfaEnabledPercent}%`);
    }
  } catch (e) {
    console.error('[collectEnvironmentMetrics] MFA check failed:', e);
  }

  // 4. Conditional Access policies
  try {
    const { data: caData } = await graphFetchSafe(accessToken, '/identity/conditionalAccess/policies');
    if (caData?.value) {
      const enabledPolicies = caData.value.filter((p: any) => p.state === 'enabled');
      metrics.conditionalAccessEnabled = enabledPolicies.length > 0;
      metrics.conditionalAccessPoliciesCount = enabledPolicies.length;
      console.log(`[collectEnvironmentMetrics] CA policies: ${enabledPolicies.length}`);
    }
  } catch (e) {
    console.error('[collectEnvironmentMetrics] CA check failed:', e);
  }

  // 5. Security Defaults
  try {
    const { data: secDefaults } = await graphFetchSafe(accessToken, '/policies/identitySecurityDefaultsEnforcementPolicy');
    metrics.securityDefaultsEnabled = secDefaults?.isEnabled === true;
    console.log(`[collectEnvironmentMetrics] Security defaults: ${metrics.securityDefaultsEnabled}`);
  } catch (e) {
    console.error('[collectEnvironmentMetrics] Security defaults check failed:', e);
  }

  // 6. Applications count
  try {
    // App registrations
    const { data: appsCount } = await graphFetchSafe(accessToken, '/applications/$count', { consistency: true });
    metrics.appRegistrationsCount = typeof appsCount === 'number' ? appsCount : 0;

    // Enterprise apps (service principals)
    const { data: spCount } = await graphFetchSafe(accessToken, '/servicePrincipals/$count', { consistency: true });
    metrics.enterpriseAppsCount = typeof spCount === 'number' ? spCount : 0;
    console.log(`[collectEnvironmentMetrics] Apps: ${metrics.appRegistrationsCount} registrations, ${metrics.enterpriseAppsCount} enterprise`);
  } catch (e) {
    console.error('[collectEnvironmentMetrics] Apps count failed:', e);
  }

  // 7. Sign-in countries (requires Azure AD P1/P2)
  try {
    const { data: signIns } = await graphFetchSafe(
      accessToken,
      '/auditLogs/signIns?$select=location,status&$top=500',
      { beta: true }
    );
    if (signIns?.value) {
      const countries = new Map<string, { success: number; fail: number }>();
      signIns.value.forEach((s: any) => {
        const country = s.location?.countryOrRegion;
        if (country) {
          const current = countries.get(country) || { success: 0, fail: 0 };
          // errorCode 0 = success, any other = failure
          if (s.status?.errorCode === 0) {
            current.success++;
          } else {
            current.fail++;
          }
          countries.set(country, current);
        }
      });
      metrics.loginCountries = Array.from(countries.entries())
        .map(([country, counts]) => ({ country, success: counts.success, fail: counts.fail }))
        .sort((a, b) => (b.success + b.fail) - (a.success + a.fail))
        .slice(0, 5);
      console.log(`[collectEnvironmentMetrics] Login countries: ${metrics.loginCountries.map(c => `${c.country}(${c.success}/${c.fail})`).join(', ')}`);
    }
  } catch (e) {
    console.error('[collectEnvironmentMetrics] Sign-in logs failed:', e);
  }

  console.log('[collectEnvironmentMetrics] Collection complete');
  return metrics;
}

// ========== IDENTITY COLLECTOR (IDT-001 to IDT-006) ==========

async function collectIdentityInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  // IDT-001: Users without MFA
  try {
    const { data: mfaData, error: mfaErr } = await graphFetchSafe(accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999', { consistency: true });
    
    if (mfaData) {
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
        affectedEntities: noMfa.slice(0, 20).map((u: any) => ({ id: u.id, displayName: u.userDisplayName || u.userPrincipalName })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Authentication methods', 'Policies'],
          passosDetalhados: ['Acesse o portal Entra ID', 'Navegue até Protection > Authentication methods', 'Configure políticas de MFA obrigatório'],
        },
        detectedAt: now,
        endpointUsado: '/reports/authenticationMethods/userRegistrationDetails',
      });
    } else if (mfaErr) {
      errors.push(`IDT-001: ${mfaErr}`);
    }
  } catch (e) {
    errors.push(`IDT-001: ${String(e)}`);
  }

  // IDT-002: Inactive users (>90 days)
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: usersData, error: usersErr } = await graphFetchSafe(
      accessToken,
      `/users?$select=id,displayName,userPrincipalName,signInActivity,accountEnabled&$filter=accountEnabled eq true&$top=999`,
      { consistency: true, beta: true }
    );

    if (usersData) {
      const users = usersData.value || [];
      const inactiveUsers = users.filter((u: any) => {
        const lastSignIn = u.signInActivity?.lastSignInDateTime;
        if (!lastSignIn) return true; // Never signed in
        return new Date(lastSignIn) < new Date(ninetyDaysAgo);
      });

      insights.push({
        id: 'IDT-002', code: 'IDT-002', category: 'identities', product: 'entra_id',
        severity: inactiveUsers.length > 20 ? 'high' : inactiveUsers.length > 5 ? 'medium' : 'info',
        titulo: 'Usuários Inativos (>90 dias)',
        descricaoExecutiva: inactiveUsers.length > 0
          ? `${inactiveUsers.length} usuário(s) ativo(s) sem login há mais de 90 dias.`
          : 'Todos os usuários ativos têm atividade recente.',
        riscoTecnico: 'Contas inativas são alvos de ataques e podem indicar ex-funcionários com acesso.',
        impactoNegocio: 'Licenças desperdiçadas e superfície de ataque expandida.',
        scoreImpacto: inactiveUsers.length > 5 ? 4 : 0,
        status: inactiveUsers.length > 5 ? 'fail' : 'pass',
        affectedCount: inactiveUsers.length,
        affectedEntities: inactiveUsers.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.displayName || u.userPrincipalName,
          details: { lastSignIn: u.signInActivity?.lastSignInDateTime || 'Nunca' }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'Users', 'All users'],
          passosDetalhados: ['Revise a lista de usuários inativos', 'Desabilite contas de ex-funcionários', 'Considere automatizar cleanup com Access Reviews'],
        },
        detectedAt: now,
        endpointUsado: '/users (beta com signInActivity)',
      });
    } else if (usersErr) {
      errors.push(`IDT-002: ${usersErr}`);
    }
  } catch (e) {
    errors.push(`IDT-002: ${String(e)}`);
  }

  // IDT-003: Guest users without sponsor
  try {
    const { data: guestsData, error: guestsErr } = await graphFetchSafe(
      accessToken,
      `/users?$filter=userType eq 'Guest'&$select=id,displayName,userPrincipalName,mail,createdDateTime,externalUserState&$top=500`,
      { consistency: true }
    );

    if (guestsData) {
      const guests = guestsData.value || [];
      // Guests without sponsor are those in 'PendingAcceptance' state or very old
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const problematicGuests = guests.filter((g: any) => {
        return g.externalUserState === 'PendingAcceptance' || 
               (g.createdDateTime && new Date(g.createdDateTime) < sixMonthsAgo);
      });

      insights.push({
        id: 'IDT-003', code: 'IDT-003', category: 'identities', product: 'entra_id',
        severity: problematicGuests.length > 10 ? 'medium' : problematicGuests.length > 0 ? 'low' : 'info',
        titulo: 'Usuários Convidados (Guests) Problemáticos',
        descricaoExecutiva: problematicGuests.length > 0
          ? `${problematicGuests.length} guest(s) pendente(s) ou muito antigo(s) detectado(s).`
          : `${guests.length} guests no tenant - todos em estado válido.`,
        riscoTecnico: 'Guests abandonados ou pendentes expandem superfície de ataque.',
        impactoNegocio: 'Acesso externo descontrolado pode violar compliance.',
        scoreImpacto: problematicGuests.length > 10 ? 3 : 0,
        status: problematicGuests.length > 10 ? 'fail' : 'pass',
        affectedCount: problematicGuests.length,
        affectedEntities: problematicGuests.slice(0, 20).map((g: any) => ({
          id: g.id,
          displayName: g.displayName || g.mail || g.userPrincipalName,
          details: { state: g.externalUserState, created: g.createdDateTime }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'External Identities', 'All guests'],
          passosDetalhados: ['Configure Access Reviews para guests', 'Remova convites pendentes antigos', 'Implemente política de expiração de guests'],
        },
        detectedAt: now,
        endpointUsado: '/users?$filter=userType eq Guest',
      });
    } else if (guestsErr) {
      errors.push(`IDT-003: ${guestsErr}`);
    }
  } catch (e) {
    errors.push(`IDT-003: ${String(e)}`);
  }

  // IDT-004: Inactive guest users (>60 days)
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: guestActivityData, error: guestActivityErr } = await graphFetchSafe(
      accessToken,
      `/users?$filter=userType eq 'Guest'&$select=id,displayName,userPrincipalName,signInActivity&$top=500`,
      { consistency: true, beta: true }
    );

    if (guestActivityData) {
      const guests = guestActivityData.value || [];
      const inactiveGuests = guests.filter((g: any) => {
        const lastSignIn = g.signInActivity?.lastSignInDateTime;
        if (!lastSignIn) return true;
        return new Date(lastSignIn) < new Date(sixtyDaysAgo);
      });

      insights.push({
        id: 'IDT-004', code: 'IDT-004', category: 'identities', product: 'entra_id',
        severity: inactiveGuests.length > 15 ? 'medium' : inactiveGuests.length > 0 ? 'low' : 'info',
        titulo: 'Guests Inativos (>60 dias)',
        descricaoExecutiva: inactiveGuests.length > 0
          ? `${inactiveGuests.length} guest(s) sem atividade há mais de 60 dias.`
          : 'Todos os guests têm atividade recente.',
        riscoTecnico: 'Guests inativos podem ser contas esquecidas com acessos ativos.',
        impactoNegocio: 'Risco de acesso não autorizado por parceiros antigos.',
        scoreImpacto: inactiveGuests.length > 15 ? 3 : 0,
        status: inactiveGuests.length > 15 ? 'fail' : 'pass',
        affectedCount: inactiveGuests.length,
        affectedEntities: inactiveGuests.slice(0, 20).map((g: any) => ({
          id: g.id,
          displayName: g.displayName || g.userPrincipalName,
          details: { lastSignIn: g.signInActivity?.lastSignInDateTime || 'Nunca' }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'External Identities', 'All guests'],
          passosDetalhados: ['Configure Access Reviews automáticos para guests', 'Defina política de expiração de 90 dias'],
        },
        detectedAt: now,
        endpointUsado: '/users (beta com signInActivity)',
      });
    } else if (guestActivityErr) {
      errors.push(`IDT-004: ${guestActivityErr}`);
    }
  } catch (e) {
    errors.push(`IDT-004: ${String(e)}`);
  }

  // IDT-005: Users with expired/never changed password
  try {
    const { data: pwdData, error: pwdErr } = await graphFetchSafe(
      accessToken,
      `/users?$select=id,displayName,userPrincipalName,lastPasswordChangeDateTime,passwordPolicies&$top=999`,
      { consistency: true }
    );

    if (pwdData) {
      const users = pwdData.value || [];
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const oldPasswords = users.filter((u: any) => {
        if (!u.lastPasswordChangeDateTime) return true;
        return new Date(u.lastPasswordChangeDateTime) < oneYearAgo;
      });

      insights.push({
        id: 'IDT-005', code: 'IDT-005', category: 'identities', product: 'entra_id',
        severity: oldPasswords.length > 20 ? 'medium' : oldPasswords.length > 0 ? 'low' : 'info',
        titulo: 'Senhas Antigas (>1 ano)',
        descricaoExecutiva: oldPasswords.length > 0
          ? `${oldPasswords.length} usuário(s) com senha não alterada há mais de 1 ano.`
          : 'Todas as senhas foram alteradas recentemente.',
        riscoTecnico: 'Senhas antigas têm maior probabilidade de estarem comprometidas.',
        impactoNegocio: 'Maior risco de acesso não autorizado.',
        scoreImpacto: oldPasswords.length > 20 ? 2 : 0,
        status: oldPasswords.length > 20 ? 'fail' : 'pass',
        affectedCount: oldPasswords.length,
        affectedEntities: oldPasswords.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.displayName || u.userPrincipalName,
          details: { lastChange: u.lastPasswordChangeDateTime || 'Nunca' }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Password reset'],
          passosDetalhados: ['Considere habilitar Self-Service Password Reset', 'Avalie política de rotação de senhas', 'Priorize MFA sobre rotação frequente'],
        },
        detectedAt: now,
        endpointUsado: '/users?$select=lastPasswordChangeDateTime',
      });
    } else if (pwdErr) {
      errors.push(`IDT-005: ${pwdErr}`);
    }
  } catch (e) {
    errors.push(`IDT-005: ${String(e)}`);
  }

  // IDT-006: Disabled users count (for awareness)
  try {
    const { data: disabledData, error: disabledErr } = await graphFetchSafe(
      accessToken,
      `/users/$count?$filter=accountEnabled eq false`,
      { consistency: true }
    );

    if (disabledData !== null) {
      const disabledCount = typeof disabledData === 'number' ? disabledData : 0;
      
      insights.push({
        id: 'IDT-006', code: 'IDT-006', category: 'identities', product: 'entra_id',
        severity: 'info',
        titulo: 'Contas Desabilitadas',
        descricaoExecutiva: `${disabledCount} conta(s) desabilitada(s) no tenant.`,
        riscoTecnico: 'Contas desabilitadas devem ser periodicamente removidas.',
        impactoNegocio: 'Manutenção de diretório e compliance.',
        scoreImpacto: 0,
        status: 'pass',
        affectedCount: disabledCount,
        affectedEntities: [],
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Identity', 'Users', 'Deleted users'],
          passosDetalhados: ['Revise contas desabilitadas periodicamente', 'Delete permanentemente contas não necessárias'],
        },
        detectedAt: now,
        endpointUsado: '/users/$count',
      });
    } else if (disabledErr) {
      errors.push(`IDT-006: ${disabledErr}`);
    }
  } catch (e) {
    errors.push(`IDT-006: ${String(e)}`);
  }

  return { insights, errors };
}

// ========== ADMIN PRIVILEGES COLLECTOR (ADM-001 to ADM-006) ==========

async function collectAdminInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  let globalAdmins: any[] = [];
  let allAdminRoleMembers: any[] = [];

  // Get all privileged roles and their members
  const privilegedRoles = [
    'Global Administrator',
    'Privileged Role Administrator', 
    'Security Administrator',
    'Exchange Administrator',
    'SharePoint Administrator',
    'User Administrator',
    'Billing Administrator',
    'Conditional Access Administrator',
    'Application Administrator',
    'Cloud Application Administrator',
    'Helpdesk Administrator',
    'Authentication Administrator',
    'Password Administrator',
  ];

  try {
    const { data: rolesData, error: rolesErr } = await graphFetchSafe(accessToken, '/directoryRoles');
    
    if (rolesData) {
      const roles = rolesData.value || [];
      
      for (const role of roles) {
        if (privilegedRoles.includes(role.displayName)) {
          const { data: membersData } = await graphFetchSafe(accessToken, `/directoryRoles/${role.id}/members`);
          if (membersData) {
            const members = membersData.value || [];
            for (const member of members) {
              allAdminRoleMembers.push({ ...member, roleName: role.displayName, roleId: role.id });
              if (role.displayName === 'Global Administrator') {
                globalAdmins.push(member);
              }
            }
          }
        }
      }
    } else if (rolesErr) {
      errors.push(`ADM: ${rolesErr}`);
    }
  } catch (e) {
    errors.push(`ADM: ${String(e)}`);
  }

  // ADM-001: Too many Global Admins
  insights.push({
    id: 'ADM-001', code: 'ADM-001', category: 'admin_privileges', product: 'entra_id',
    severity: globalAdmins.length > 8 ? 'critical' : globalAdmins.length > 5 ? 'high' : 'info',
    titulo: 'Quantidade de Global Admins',
    descricaoExecutiva: globalAdmins.length > 5
      ? `${globalAdmins.length} Global Admins detectados. Recomendado: máximo 5.`
      : `${globalAdmins.length} Global Admin(s) - dentro do limite recomendado.`,
    riscoTecnico: 'Excesso de Global Admins aumenta a superfície de ataque e dificulta auditoria.',
    impactoNegocio: 'Maior risco de comprometimento de conta privilegiada.',
    scoreImpacto: globalAdmins.length > 5 ? 6 : 0,
    status: globalAdmins.length > 5 ? 'fail' : 'pass',
    affectedCount: globalAdmins.length,
    affectedEntities: globalAdmins.slice(0, 20).map((a: any) => ({ id: a.id, displayName: a.displayName || a.userPrincipalName })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Identity', 'Roles and administrators', 'Global Administrator'],
      passosDetalhados: ['Revise a lista de Global Admins', 'Use roles mais específicos', 'Implemente PIM para acesso just-in-time'],
    },
    detectedAt: now,
    endpointUsado: '/directoryRoles',
  });

  // ADM-002: Check MFA status for all admins
  try {
    const { data: mfaData } = await graphFetchSafe(accessToken, '/reports/authenticationMethods/userRegistrationDetails?$top=999', { consistency: true });
    
    if (mfaData) {
      const mfaUsers = mfaData.value || [];
      const mfaMap = new Map(mfaUsers.map((u: any) => [u.id, u]));

      const adminsWithoutMfa = globalAdmins.filter((admin: any) => {
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
        affectedEntities: adminsWithoutMfa.slice(0, 20).map((a: any) => ({ id: a.id, displayName: a.displayName })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Conditional Access', 'Require MFA for admins'],
          passosDetalhados: ['Crie política de Conditional Access', 'Exija MFA para todas as roles administrativas'],
        },
        detectedAt: now,
        endpointUsado: '/reports/authenticationMethods/userRegistrationDetails',
      });
    }
  } catch (e) {
    errors.push(`ADM-002: ${String(e)}`);
  }

  // ADM-003: Total privileged users count
  const uniqueAdmins = new Map<string, any>();
  for (const admin of allAdminRoleMembers) {
    if (!uniqueAdmins.has(admin.id)) {
      uniqueAdmins.set(admin.id, { ...admin, roles: [admin.roleName] });
    } else {
      uniqueAdmins.get(admin.id).roles.push(admin.roleName);
    }
  }

  const totalPrivilegedUsers = uniqueAdmins.size;
  insights.push({
    id: 'ADM-003', code: 'ADM-003', category: 'admin_privileges', product: 'entra_id',
    severity: totalPrivilegedUsers > 30 ? 'high' : totalPrivilegedUsers > 15 ? 'medium' : 'info',
    titulo: 'Total de Usuários Privilegiados',
    descricaoExecutiva: `${totalPrivilegedUsers} usuário(s) com roles administrativas no tenant.`,
    riscoTecnico: 'Quanto mais usuários privilegiados, maior a superfície de ataque.',
    impactoNegocio: 'Dificuldade de auditoria e controle de acesso.',
    scoreImpacto: totalPrivilegedUsers > 30 ? 5 : 0,
    status: totalPrivilegedUsers > 30 ? 'fail' : 'pass',
    affectedCount: totalPrivilegedUsers,
    affectedEntities: Array.from(uniqueAdmins.values()).slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
      details: { roles: a.roles.join(', ') }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Identity', 'Roles and administrators'],
      passosDetalhados: ['Revise todas as atribuições de roles', 'Use o princípio do menor privilégio', 'Implemente PIM'],
    },
    detectedAt: now,
    endpointUsado: '/directoryRoles/*/members',
  });

  // ADM-004: Users with multiple admin roles
  const multiRoleAdmins = Array.from(uniqueAdmins.values()).filter((a: any) => a.roles.length > 2);
  insights.push({
    id: 'ADM-004', code: 'ADM-004', category: 'admin_privileges', product: 'entra_id',
    severity: multiRoleAdmins.length > 5 ? 'medium' : multiRoleAdmins.length > 0 ? 'low' : 'info',
    titulo: 'Usuários com Múltiplas Roles Admin',
    descricaoExecutiva: multiRoleAdmins.length > 0
      ? `${multiRoleAdmins.length} usuário(s) com mais de 2 roles administrativas.`
      : 'Nenhum usuário com acúmulo excessivo de roles.',
    riscoTecnico: 'Acúmulo de roles viola segregação de funções.',
    impactoNegocio: 'Risco de fraude e dificuldade de auditoria.',
    scoreImpacto: multiRoleAdmins.length > 5 ? 3 : 0,
    status: multiRoleAdmins.length > 5 ? 'fail' : 'pass',
    affectedCount: multiRoleAdmins.length,
    affectedEntities: multiRoleAdmins.slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
      details: { roles: a.roles.join(', '), roleCount: a.roles.length }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Identity', 'Roles and administrators'],
      passosDetalhados: ['Revise usuários com múltiplas roles', 'Distribua responsabilidades entre pessoas diferentes'],
    },
    detectedAt: now,
    endpointUsado: '/directoryRoles/*/members',
  });

  // ADM-005: Guests with admin roles
  const guestAdmins = allAdminRoleMembers.filter((a: any) => a.userType === 'Guest');
  const uniqueGuestAdmins = [...new Map(guestAdmins.map(g => [g.id, g])).values()];
  
  insights.push({
    id: 'ADM-005', code: 'ADM-005', category: 'admin_privileges', product: 'entra_id',
    severity: uniqueGuestAdmins.length > 0 ? 'critical' : 'info',
    titulo: 'Guests com Roles Administrativas',
    descricaoExecutiva: uniqueGuestAdmins.length > 0
      ? `${uniqueGuestAdmins.length} usuário(s) guest(s) com roles administrativas!`
      : 'Nenhum guest possui roles administrativas.',
    riscoTecnico: 'Guests com privilégios elevados são alto risco de segurança.',
    impactoNegocio: 'Usuários externos com controle do tenant.',
    scoreImpacto: uniqueGuestAdmins.length > 0 ? 8 : 0,
    status: uniqueGuestAdmins.length > 0 ? 'fail' : 'pass',
    affectedCount: uniqueGuestAdmins.length,
    affectedEntities: uniqueGuestAdmins.slice(0, 20).map((g: any) => ({
      id: g.id,
      displayName: g.displayName || g.userPrincipalName,
      details: { role: g.roleName }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Identity', 'Roles and administrators'],
      passosDetalhados: ['Remova guests de roles administrativas imediatamente', 'Converta para usuário interno se necessário'],
    },
    detectedAt: now,
    endpointUsado: '/directoryRoles/*/members',
  });

  // ADM-006: Service Principals with admin roles
  const spAdmins = allAdminRoleMembers.filter((a: any) => a['@odata.type'] === '#microsoft.graph.servicePrincipal');
  
  insights.push({
    id: 'ADM-006', code: 'ADM-006', category: 'admin_privileges', product: 'entra_id',
    severity: spAdmins.length > 3 ? 'medium' : spAdmins.length > 0 ? 'low' : 'info',
    titulo: 'Service Principals com Roles Admin',
    descricaoExecutiva: spAdmins.length > 0
      ? `${spAdmins.length} service principal(s) com roles administrativas.`
      : 'Nenhum service principal com roles administrativas.',
    riscoTecnico: 'SPs com privilégios podem ser explorados se credenciais vazarem.',
    impactoNegocio: 'Automações com acesso excessivo.',
    scoreImpacto: spAdmins.length > 3 ? 4 : 0,
    status: spAdmins.length > 3 ? 'fail' : 'pass',
    affectedCount: spAdmins.length,
    affectedEntities: spAdmins.slice(0, 20).map((sp: any) => ({
      id: sp.id,
      displayName: sp.displayName || sp.appDisplayName,
      details: { role: sp.roleName }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'Enterprise applications'],
      passosDetalhados: ['Revise SPs com roles administrativas', 'Use Managed Identities quando possível', 'Limite permissões ao mínimo necessário'],
    },
    detectedAt: now,
    endpointUsado: '/directoryRoles/*/members',
  });

  return { insights, errors };
}

// ========== AUTH & ACCESS COLLECTOR (AUT-001 to AUT-007) ==========

async function collectAuthInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  // AUT-001: Security Defaults
  try {
    const { data: secData, error: secErr } = await graphFetchSafe(accessToken, '/policies/identitySecurityDefaultsEnforcementPolicy');

    if (secData) {
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
        endpointUsado: '/policies/identitySecurityDefaultsEnforcementPolicy',
      });
    } else if (secErr) {
      errors.push(`AUT-001: ${secErr}`);
    }
  } catch (e) {
    errors.push(`AUT-001: ${String(e)}`);
  }

  // AUT-002: Conditional Access Policies
  try {
    const { data: caData, error: caErr } = await graphFetchSafe(accessToken, '/identity/conditionalAccess/policies');

    if (caData) {
      const policies = caData.value || [];
      const enabledPolicies = policies.filter((p: any) => p.state === 'enabled');
      const disabledPolicies = policies.filter((p: any) => p.state === 'disabled');

      const hasMfaPolicy = enabledPolicies.some((p: any) => 
        p.grantControls?.builtInControls?.includes('mfa')
      );

      insights.push({
        id: 'AUT-002', code: 'AUT-002', category: 'auth_access', product: 'entra_id',
        severity: enabledPolicies.length === 0 ? 'critical' : !hasMfaPolicy ? 'high' : 'info',
        titulo: 'Políticas de Conditional Access',
        descricaoExecutiva: enabledPolicies.length > 0
          ? `${enabledPolicies.length} política(s) ativa(s)${hasMfaPolicy ? ' incluindo MFA' : ', nenhuma exige MFA'}.`
          : 'Nenhuma política de Conditional Access habilitada!',
        riscoTecnico: 'Sem CA, não há controle granular de acesso baseado em risco.',
        impactoNegocio: 'Exposição a acessos não autorizados e não conformidade.',
        scoreImpacto: enabledPolicies.length === 0 ? 8 : !hasMfaPolicy ? 5 : 0,
        status: enabledPolicies.length > 0 && hasMfaPolicy ? 'pass' : 'fail',
        affectedCount: policies.length,
        affectedEntities: policies.slice(0, 20).map((p: any) => ({
          id: p.id,
          displayName: `${p.displayName} (${p.state})`,
          details: { state: p.state, mfa: p.grantControls?.builtInControls?.includes('mfa') }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Conditional Access', 'Policies'],
          passosDetalhados: ['Crie políticas de CA para exigir MFA', 'Bloqueie legacy authentication', 'Configure políticas baseadas em risco'],
        },
        detectedAt: now,
        endpointUsado: '/identity/conditionalAccess/policies',
      });

      // AUT-006: Check for legacy auth blocking
      const blocksLegacyAuth = enabledPolicies.some((p: any) =>
        p.conditions?.clientAppTypes?.includes('exchangeActiveSync') ||
        p.conditions?.clientAppTypes?.includes('other')
      );

      insights.push({
        id: 'AUT-006', code: 'AUT-006', category: 'auth_access', product: 'entra_id',
        severity: !blocksLegacyAuth ? 'high' : 'info',
        titulo: 'Bloqueio de Legacy Authentication',
        descricaoExecutiva: blocksLegacyAuth
          ? 'Política de bloqueio de legacy auth detectada.'
          : 'Nenhuma política bloqueando legacy authentication!',
        riscoTecnico: 'Legacy auth não suporta MFA e é alvo comum de ataques.',
        impactoNegocio: 'Alto risco de comprometimento via protocolos legados.',
        scoreImpacto: !blocksLegacyAuth ? 6 : 0,
        status: blocksLegacyAuth ? 'pass' : 'fail',
        affectedCount: blocksLegacyAuth ? 0 : 1,
        affectedEntities: [],
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Conditional Access', 'Policies'],
          passosDetalhados: ['Crie política para bloquear legacy auth', 'Exclua apps críticos se necessário', 'Migre apps para modern auth'],
        },
        detectedAt: now,
        endpointUsado: '/identity/conditionalAccess/policies',
      });
    } else if (caErr) {
      errors.push(`AUT-002: ${caErr}`);
    }
  } catch (e) {
    errors.push(`AUT-002: ${String(e)}`);
  }

  // AUT-003: Risky sign-ins (last 7 days)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: riskyData, error: riskyErr } = await graphFetchSafe(
      accessToken,
      `/identityProtection/riskDetections?$filter=detectedDateTime ge ${sevenDaysAgo}&$top=100`,
      { beta: true }
    );

    if (riskyData) {
      const detections = riskyData.value || [];
      const highRisk = detections.filter((d: any) => d.riskLevel === 'high');
      const mediumRisk = detections.filter((d: any) => d.riskLevel === 'medium');

      insights.push({
        id: 'AUT-003', code: 'AUT-003', category: 'auth_access', product: 'entra_id',
        severity: highRisk.length > 0 ? 'critical' : mediumRisk.length > 5 ? 'high' : detections.length > 0 ? 'medium' : 'info',
        titulo: 'Detecções de Risco (7 dias)',
        descricaoExecutiva: detections.length > 0
          ? `${detections.length} detecção(ões): ${highRisk.length} alta, ${mediumRisk.length} média.`
          : 'Nenhuma detecção de risco nos últimos 7 dias.',
        riscoTecnico: 'Detecções de risco indicam possíveis tentativas de comprometimento.',
        impactoNegocio: 'Contas podem estar comprometidas ativamente.',
        scoreImpacto: highRisk.length > 0 ? 8 : mediumRisk.length > 5 ? 5 : 0,
        status: highRisk.length > 0 || mediumRisk.length > 5 ? 'fail' : 'pass',
        affectedCount: detections.length,
        affectedEntities: detections.slice(0, 20).map((d: any) => ({
          id: d.id,
          displayName: `${d.userDisplayName || d.userPrincipalName} - ${d.riskEventType}`,
          details: { riskLevel: d.riskLevel, riskType: d.riskEventType, detected: d.detectedDateTime }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Identity Protection', 'Risk detections'],
          passosDetalhados: ['Investigue cada detecção de risco alto', 'Force reset de senha para usuários comprometidos', 'Configure políticas de risco automatizadas'],
        },
        detectedAt: now,
        endpointUsado: '/identityProtection/riskDetections',
      });
    } else if (riskyErr) {
      errors.push(`AUT-003: ${riskyErr}`);
    }
  } catch (e) {
    errors.push(`AUT-003: ${String(e)}`);
  }

  // AUT-004: Risky users
  try {
    const { data: riskyUsersData, error: riskyUsersErr } = await graphFetchSafe(
      accessToken,
      '/identityProtection/riskyUsers?$filter=riskState eq \'atRisk\' or riskState eq \'confirmedCompromised\'&$top=100',
      { beta: true }
    );

    if (riskyUsersData) {
      const riskyUsers = riskyUsersData.value || [];
      const confirmed = riskyUsers.filter((u: any) => u.riskState === 'confirmedCompromised');
      const atRisk = riskyUsers.filter((u: any) => u.riskState === 'atRisk');

      insights.push({
        id: 'AUT-004', code: 'AUT-004', category: 'auth_access', product: 'entra_id',
        severity: confirmed.length > 0 ? 'critical' : atRisk.length > 5 ? 'high' : atRisk.length > 0 ? 'medium' : 'info',
        titulo: 'Usuários de Risco',
        descricaoExecutiva: riskyUsers.length > 0
          ? `${riskyUsers.length} usuário(s) de risco: ${confirmed.length} confirmado(s), ${atRisk.length} em risco.`
          : 'Nenhum usuário de risco identificado.',
        riscoTecnico: 'Usuários de risco podem ter credenciais comprometidas.',
        impactoNegocio: 'Acesso não autorizado a dados e sistemas.',
        scoreImpacto: confirmed.length > 0 ? 10 : atRisk.length > 5 ? 6 : 0,
        status: confirmed.length > 0 || atRisk.length > 5 ? 'fail' : 'pass',
        affectedCount: riskyUsers.length,
        affectedEntities: riskyUsers.slice(0, 20).map((u: any) => ({
          id: u.id,
          displayName: u.userDisplayName || u.userPrincipalName,
          details: { riskState: u.riskState, riskLevel: u.riskLevel, riskDetail: u.riskDetail }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Identity Protection', 'Risky users'],
          passosDetalhados: ['Force reset de senha imediato para confirmados', 'Investigue usuários em risco', 'Revogue sessões ativas'],
        },
        detectedAt: now,
        endpointUsado: '/identityProtection/riskyUsers',
      });
    } else if (riskyUsersErr) {
      errors.push(`AUT-004: ${riskyUsersErr}`);
    }
  } catch (e) {
    errors.push(`AUT-004: ${String(e)}`);
  }

  // AUT-005: Self-Service Password Reset (SSPR)
  try {
    const { data: authMethodsData, error: authMethodsErr } = await graphFetchSafe(
      accessToken,
      '/policies/authenticationMethodsPolicy',
      { beta: true }
    );

    if (authMethodsData) {
      const methods = authMethodsData.authenticationMethodConfigurations || [];
      const enabledMethods = methods.filter((m: any) => m.state === 'enabled');

      insights.push({
        id: 'AUT-005', code: 'AUT-005', category: 'auth_access', product: 'entra_id',
        severity: enabledMethods.length < 2 ? 'low' : 'info',
        titulo: 'Métodos de Autenticação Configurados',
        descricaoExecutiva: `${enabledMethods.length} método(s) de autenticação habilitado(s).`,
        riscoTecnico: 'Poucos métodos limitam opções de recuperação e MFA.',
        impactoNegocio: 'Usuários podem ter dificuldade em recuperar acesso.',
        scoreImpacto: 0,
        status: 'pass',
        affectedCount: enabledMethods.length,
        affectedEntities: enabledMethods.slice(0, 20).map((m: any) => ({
          id: m.id,
          displayName: m.id,
          details: { state: m.state }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Authentication methods'],
          passosDetalhados: ['Habilite múltiplos métodos de autenticação', 'Priorize Authenticator e passkeys'],
        },
        detectedAt: now,
        endpointUsado: '/policies/authenticationMethodsPolicy',
      });
    } else if (authMethodsErr) {
      errors.push(`AUT-005: ${authMethodsErr}`);
    }
  } catch (e) {
    errors.push(`AUT-005: ${String(e)}`);
  }

  // AUT-007: Named locations configured
  try {
    const { data: locationsData, error: locationsErr } = await graphFetchSafe(accessToken, '/identity/conditionalAccess/namedLocations');

    if (locationsData) {
      const locations = locationsData.value || [];
      const trustedLocations = locations.filter((l: any) => l.isTrusted);

      insights.push({
        id: 'AUT-007', code: 'AUT-007', category: 'auth_access', product: 'entra_id',
        severity: locations.length === 0 ? 'medium' : 'info',
        titulo: 'Locais Nomeados (Named Locations)',
        descricaoExecutiva: locations.length > 0
          ? `${locations.length} local(is) configurado(s), ${trustedLocations.length} confiável(is).`
          : 'Nenhum local nomeado configurado.',
        riscoTecnico: 'Sem named locations, não é possível aplicar políticas baseadas em localização.',
        impactoNegocio: 'Falta de controle de acesso geográfico.',
        scoreImpacto: locations.length === 0 ? 2 : 0,
        status: locations.length > 0 ? 'pass' : 'fail',
        affectedCount: locations.length,
        affectedEntities: locations.slice(0, 20).map((l: any) => ({
          id: l.id,
          displayName: l.displayName,
          details: { trusted: l.isTrusted, type: l['@odata.type'] }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Protection', 'Conditional Access', 'Named locations'],
          passosDetalhados: ['Configure IPs/países confiáveis', 'Use em políticas de CA para acesso condicional'],
        },
        detectedAt: now,
        endpointUsado: '/identity/conditionalAccess/namedLocations',
      });
    } else if (locationsErr) {
      errors.push(`AUT-007: ${locationsErr}`);
    }
  } catch (e) {
    errors.push(`AUT-007: ${String(e)}`);
  }

  return { insights, errors };
}

// ========== APPS & INTEGRATIONS COLLECTOR (APP-001 to APP-007) ==========

async function collectAppsInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  let allApps: any[] = [];

  // Get all applications
  try {
    const { data: appsData, error: appsErr } = await graphFetchSafe(
      accessToken,
      '/applications?$select=id,displayName,appId,passwordCredentials,keyCredentials,requiredResourceAccess,createdDateTime&$expand=owners&$top=500'
    );

    if (appsData) {
      allApps = appsData.value || [];
    } else if (appsErr) {
      errors.push(`APP: ${appsErr}`);
    }
  } catch (e) {
    errors.push(`APP: ${String(e)}`);
  }

  const nowDate = new Date();
  const thirtyDaysFromNow = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiredApps: any[] = [];
  const expiringApps: any[] = [];

  for (const app of allApps) {
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
    severity: expiringApps.length > 5 ? 'high' : expiringApps.length > 0 ? 'medium' : 'info',
    titulo: 'Credenciais Expirando em 30 dias',
    descricaoExecutiva: expiringApps.length > 0
      ? `${expiringApps.length} aplicação(ões) com credenciais expirando.`
      : 'Nenhuma credencial expirando em breve.',
    riscoTecnico: 'Credenciais expiradas podem causar interrupção de serviços.',
    impactoNegocio: 'Integrações podem parar de funcionar sem aviso.',
    scoreImpacto: expiringApps.length > 5 ? 4 : expiringApps.length > 0 ? 2 : 0,
    status: expiringApps.length > 5 ? 'fail' : 'pass',
    affectedCount: expiringApps.length,
    affectedEntities: expiringApps.slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
      details: { expiry: new Date(a.credExpiry).toLocaleDateString('pt-BR') }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'App registrations', 'Certificates & secrets'],
      passosDetalhados: ['Acesse cada aplicação listada', 'Renove as credenciais antes da expiração', 'Configure alertas de expiração'],
    },
    detectedAt: now,
    endpointUsado: '/applications',
  });

  // APP-002: Expired credentials
  insights.push({
    id: 'APP-002', code: 'APP-002', category: 'apps_integrations', product: 'entra_id',
    severity: expiredApps.length > 0 ? 'high' : 'info',
    titulo: 'Credenciais Expiradas',
    descricaoExecutiva: expiredApps.length > 0
      ? `${expiredApps.length} aplicação(ões) com credenciais já expiradas.`
      : 'Nenhuma credencial expirada.',
    riscoTecnico: 'Apps com credenciais expiradas não funcionam e podem indicar apps abandonados.',
    impactoNegocio: 'Serviços dependentes podem estar indisponíveis.',
    scoreImpacto: expiredApps.length > 0 ? 5 : 0,
    status: expiredApps.length > 0 ? 'fail' : 'pass',
    affectedCount: expiredApps.length,
    affectedEntities: expiredApps.slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
      details: { expired: new Date(a.credExpiry).toLocaleDateString('pt-BR') }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'App registrations'],
      passosDetalhados: ['Verifique se a aplicação ainda é necessária', 'Renove ou remova credenciais expiradas'],
    },
    detectedAt: now,
    endpointUsado: '/applications',
  });

  // APP-003: Apps with high privilege permissions
  const highPrivilegePermissions = [
    'Directory.ReadWrite.All',
    'User.ReadWrite.All',
    'Mail.ReadWrite',
    'Files.ReadWrite.All',
    'Sites.FullControl.All',
    'RoleManagement.ReadWrite.Directory',
  ];

  const highPrivilegeApps = allApps.filter((app: any) => {
    const resources = app.requiredResourceAccess || [];
    for (const resource of resources) {
      for (const access of resource.resourceAccess || []) {
        if (access.type === 'Role' && highPrivilegePermissions.some(p => access.id?.includes(p))) {
          return true;
        }
      }
    }
    return false;
  });

  insights.push({
    id: 'APP-003', code: 'APP-003', category: 'apps_integrations', product: 'entra_id',
    severity: highPrivilegeApps.length > 10 ? 'high' : highPrivilegeApps.length > 3 ? 'medium' : 'info',
    titulo: 'Apps com Permissões Elevadas',
    descricaoExecutiva: highPrivilegeApps.length > 0
      ? `${highPrivilegeApps.length} app(s) com permissões de alto privilégio.`
      : 'Nenhum app com permissões excessivas detectado.',
    riscoTecnico: 'Apps com permissões elevadas podem causar danos significativos se comprometidos.',
    impactoNegocio: 'Risco de vazamento de dados em larga escala.',
    scoreImpacto: highPrivilegeApps.length > 10 ? 5 : 0,
    status: highPrivilegeApps.length > 10 ? 'fail' : 'pass',
    affectedCount: highPrivilegeApps.length,
    affectedEntities: highPrivilegeApps.slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'App registrations', 'API permissions'],
      passosDetalhados: ['Revise permissões de cada app', 'Remova permissões não necessárias', 'Use permissões delegadas quando possível'],
    },
    detectedAt: now,
    endpointUsado: '/applications',
  });

  // APP-004: Apps without owners
  const noOwnerApps = allApps.filter((app: any) => !app.owners || app.owners.length === 0);

  insights.push({
    id: 'APP-004', code: 'APP-004', category: 'apps_integrations', product: 'entra_id',
    severity: noOwnerApps.length > 10 ? 'medium' : noOwnerApps.length > 0 ? 'low' : 'info',
    titulo: 'Apps sem Owner Definido',
    descricaoExecutiva: noOwnerApps.length > 0
      ? `${noOwnerApps.length} app(s) sem owner definido.`
      : 'Todos os apps têm owners definidos.',
    riscoTecnico: 'Apps órfãos dificultam gestão e podem ser abandonados.',
    impactoNegocio: 'Falta de responsável para manutenção e segurança.',
    scoreImpacto: noOwnerApps.length > 10 ? 3 : 0,
    status: noOwnerApps.length > 10 ? 'fail' : 'pass',
    affectedCount: noOwnerApps.length,
    affectedEntities: noOwnerApps.slice(0, 20).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
      details: { created: a.createdDateTime }
    })),
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'App registrations', 'Owners'],
      passosDetalhados: ['Identifique responsável por cada app', 'Adicione owners apropriados', 'Remova apps abandonados'],
    },
    detectedAt: now,
    endpointUsado: '/applications?$expand=owners',
  });

  // APP-005: OAuth consent grants (delegated permissions granted to apps)
  try {
    const { data: consentsData, error: consentsErr } = await graphFetchSafe(
      accessToken,
      '/oauth2PermissionGrants?$top=500'
    );

    if (consentsData) {
      const grants = consentsData.value || [];
      const allPrincipalsGrants = grants.filter((g: any) => g.consentType === 'AllPrincipals');

      insights.push({
        id: 'APP-005', code: 'APP-005', category: 'apps_integrations', product: 'entra_id',
        severity: allPrincipalsGrants.length > 20 ? 'medium' : 'info',
        titulo: 'Consentimentos OAuth (Admin Consent)',
        descricaoExecutiva: `${allPrincipalsGrants.length} consentimento(s) para todos os usuários.`,
        riscoTecnico: 'Admin consents dão acesso amplo a apps de terceiros.',
        impactoNegocio: 'Dados de todos os usuários acessíveis por terceiros.',
        scoreImpacto: allPrincipalsGrants.length > 20 ? 3 : 0,
        status: allPrincipalsGrants.length > 20 ? 'fail' : 'pass',
        affectedCount: allPrincipalsGrants.length,
        affectedEntities: allPrincipalsGrants.slice(0, 20).map((g: any) => ({
          id: g.id,
          displayName: g.scope || 'N/A',
          details: { clientId: g.clientId, scope: g.scope }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'Enterprise applications', 'Consent and permissions'],
          passosDetalhados: ['Revise consentimentos admin-level', 'Revogue consentimentos não necessários', 'Configure admin consent workflow'],
        },
        detectedAt: now,
        endpointUsado: '/oauth2PermissionGrants',
      });
    } else if (consentsErr) {
      errors.push(`APP-005: ${consentsErr}`);
    }
  } catch (e) {
    errors.push(`APP-005: ${String(e)}`);
  }

  // APP-006: Service Principals count
  try {
    const { data: spsData, error: spsErr } = await graphFetchSafe(
      accessToken,
      '/servicePrincipals?$select=id,displayName,appId,servicePrincipalType,createdDateTime&$top=999'
    );

    if (spsData) {
      const sps = spsData.value || [];
      const thirdPartyApps = sps.filter((sp: any) => sp.servicePrincipalType === 'Application');
      const managedIdentities = sps.filter((sp: any) => sp.servicePrincipalType === 'ManagedIdentity');

      insights.push({
        id: 'APP-006', code: 'APP-006', category: 'apps_integrations', product: 'entra_id',
        severity: thirdPartyApps.length > 100 ? 'medium' : 'info',
        titulo: 'Service Principals no Tenant',
        descricaoExecutiva: `${sps.length} SPs: ${thirdPartyApps.length} apps, ${managedIdentities.length} managed identities.`,
        riscoTecnico: 'Muitos SPs aumentam superfície de ataque.',
        impactoNegocio: 'Dificuldade de gestão e auditoria.',
        scoreImpacto: 0,
        status: 'pass',
        affectedCount: sps.length,
        affectedEntities: sps.slice(0, 20).map((sp: any) => ({
          id: sp.id,
          displayName: sp.displayName,
          details: { type: sp.servicePrincipalType }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Applications', 'Enterprise applications'],
          passosDetalhados: ['Revise SPs periodicamente', 'Remova apps não utilizados', 'Use Managed Identities quando possível'],
        },
        detectedAt: now,
        endpointUsado: '/servicePrincipals',
      });
    } else if (spsErr) {
      errors.push(`APP-006: ${spsErr}`);
    }
  } catch (e) {
    errors.push(`APP-006: ${String(e)}`);
  }

  // APP-007: Apps total count
  insights.push({
    id: 'APP-007', code: 'APP-007', category: 'apps_integrations', product: 'entra_id',
    severity: 'info',
    titulo: 'Total de App Registrations',
    descricaoExecutiva: `${allApps.length} app(s) registrado(s) no tenant.`,
    riscoTecnico: 'Inventário de aplicações do tenant.',
    impactoNegocio: 'Visibilidade para gestão de apps.',
    scoreImpacto: 0,
    status: 'pass',
    affectedCount: allApps.length,
    affectedEntities: [],
    remediacao: {
      productAfetado: 'entra_id',
      portalUrl: 'https://entra.microsoft.com',
      caminhoPortal: ['Applications', 'App registrations'],
      passosDetalhados: ['Mantenha inventário atualizado', 'Remova apps não utilizados'],
    },
    detectedAt: now,
    endpointUsado: '/applications',
  });

  return { insights, errors };
}

// ========== EXCHANGE & EMAIL COLLECTOR (EXO-001 to EXO-005) ==========

async function collectExchangeInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  // Get sample of users for inbox rules check
  let sampleUsers: any[] = [];
  try {
    const { data: usersData } = await graphFetchSafe(accessToken, '/users?$select=id,displayName,mail,userType&$filter=userType eq \'Member\'&$top=50');
    if (usersData) {
      sampleUsers = usersData.value || [];
    }
  } catch (e) {
    errors.push(`EXO-users: ${String(e)}`);
  }

  // EXO-001: External forwarding rules
  const externalForwarding: any[] = [];
  const internalForwarding: any[] = [];

  for (const user of sampleUsers.slice(0, 20)) {
    try {
      const { data: rulesData } = await graphFetchSafe(accessToken, `/users/${user.id}/mailFolders/inbox/messageRules`);
      if (rulesData) {
        const rules = rulesData.value || [];

        for (const rule of rules) {
          if (rule.actions?.forwardTo || rule.actions?.redirectTo || rule.actions?.forwardAsAttachmentTo) {
            const allRecipients = [
              ...(rule.actions.forwardTo || []),
              ...(rule.actions.redirectTo || []),
              ...(rule.actions.forwardAsAttachmentTo || [])
            ];

            for (const recipient of allRecipients) {
              const email = recipient.emailAddress?.address || '';
              const isExternal = email && !email.toLowerCase().includes(user.mail?.split('@')[1]?.toLowerCase() || '');
              
              if (isExternal) {
                externalForwarding.push({
                  userId: user.id,
                  userName: user.displayName,
                  ruleName: rule.displayName,
                  recipient: email,
                });
              } else {
                internalForwarding.push({
                  userId: user.id,
                  userName: user.displayName,
                  ruleName: rule.displayName,
                  recipient: email,
                });
              }
            }
          }
        }
      }
    } catch {
      // Individual user rule check failed, continue
    }
  }

  insights.push({
    id: 'EXO-001', code: 'EXO-001', category: 'email_exchange', product: 'exchange_online',
    severity: externalForwarding.length > 0 ? 'critical' : 'info',
    titulo: 'Redirecionamento Externo de Email',
    descricaoExecutiva: externalForwarding.length > 0
      ? `${externalForwarding.length} regra(s) redirecionando para fora do domínio!`
      : 'Nenhuma regra de redirecionamento externo detectada.',
    riscoTecnico: 'Forwarding externo pode exfiltrar dados automaticamente.',
    impactoNegocio: 'Vazamento de informações confidenciais.',
    scoreImpacto: externalForwarding.length > 0 ? 8 : 0,
    status: externalForwarding.length > 0 ? 'fail' : 'pass',
    affectedCount: externalForwarding.length,
    affectedEntities: externalForwarding.slice(0, 20).map((f: any) => ({
      id: f.userId,
      displayName: `${f.userName}: ${f.ruleName}`,
      details: { recipient: f.recipient }
    })),
    remediacao: {
      productAfetado: 'exchange_online',
      portalUrl: 'https://admin.exchange.microsoft.com',
      caminhoPortal: ['Mail flow', 'Rules'],
      passosDetalhados: ['Investigue cada regra listada', 'Confirme com usuários se são legítimas', 'Configure transport rule para bloquear auto-forward'],
    },
    detectedAt: now,
    endpointUsado: '/users/{id}/mailFolders/inbox/messageRules',
  });

  // EXO-002: Internal forwarding rules count
  insights.push({
    id: 'EXO-002', code: 'EXO-002', category: 'email_exchange', product: 'exchange_online',
    severity: internalForwarding.length > 20 ? 'low' : 'info',
    titulo: 'Redirecionamento Interno de Email',
    descricaoExecutiva: `${internalForwarding.length} regra(s) de forwarding interno na amostra.`,
    riscoTecnico: 'Forwarding interno pode indicar compartilhamento não autorizado.',
    impactoNegocio: 'Possível vazamento interno de informações.',
    scoreImpacto: 0,
    status: 'pass',
    affectedCount: internalForwarding.length,
    affectedEntities: internalForwarding.slice(0, 20).map((f: any) => ({
      id: f.userId,
      displayName: `${f.userName}: ${f.ruleName}`,
      details: { recipient: f.recipient }
    })),
    remediacao: {
      productAfetado: 'exchange_online',
      portalUrl: 'https://admin.exchange.microsoft.com',
      caminhoPortal: ['Mail flow', 'Rules'],
      passosDetalhados: ['Revise regras de forwarding interno', 'Valide necessidade com usuários'],
    },
    detectedAt: now,
    endpointUsado: '/users/{id}/mailFolders/inbox/messageRules',
  });

  // EXO-003: Mailbox settings (auto-replies, etc.) - sample
  let autoRepliesEnabled = 0;
  for (const user of sampleUsers.slice(0, 10)) {
    try {
      const { data: settingsData } = await graphFetchSafe(accessToken, `/users/${user.id}/mailboxSettings`);
      if (settingsData?.automaticRepliesSetting?.status === 'alwaysEnabled') {
        autoRepliesEnabled++;
      }
    } catch {
      // Skip this user
    }
  }

  insights.push({
    id: 'EXO-003', code: 'EXO-003', category: 'email_exchange', product: 'exchange_online',
    severity: autoRepliesEnabled > 5 ? 'low' : 'info',
    titulo: 'Auto-Respostas Permanentes',
    descricaoExecutiva: `${autoRepliesEnabled} usuário(s) com auto-resposta sempre ativa na amostra.`,
    riscoTecnico: 'Auto-respostas permanentes podem vazar informações.',
    impactoNegocio: 'Exposição de estrutura organizacional.',
    scoreImpacto: 0,
    status: 'pass',
    affectedCount: autoRepliesEnabled,
    affectedEntities: [],
    remediacao: {
      productAfetado: 'exchange_online',
      portalUrl: 'https://admin.exchange.microsoft.com',
      caminhoPortal: ['Recipients', 'Mailboxes'],
      passosDetalhados: ['Revise auto-respostas permanentes', 'Configure política de OOF'],
    },
    detectedAt: now,
    endpointUsado: '/users/{id}/mailboxSettings',
  });

  // EXO-004: Shared mailboxes (informational)
  try {
    const { data: sharedData } = await graphFetchSafe(
      accessToken,
      '/users?$filter=userType eq \'Member\'&$select=id,displayName,mail,mailboxSettings&$top=100'
    );

    if (sharedData) {
      insights.push({
        id: 'EXO-004', code: 'EXO-004', category: 'email_exchange', product: 'exchange_online',
        severity: 'info',
        titulo: 'Mailboxes Analisadas',
        descricaoExecutiva: `Amostra de ${sampleUsers.length} mailbox(es) analisada(s).`,
        riscoTecnico: 'Análise baseada em amostra representativa.',
        impactoNegocio: 'Visibilidade parcial das configurações de email.',
        scoreImpacto: 0,
        status: 'pass',
        affectedCount: sampleUsers.length,
        affectedEntities: [],
        remediacao: {
          productAfetado: 'exchange_online',
          portalUrl: 'https://admin.exchange.microsoft.com',
          caminhoPortal: ['Recipients', 'Mailboxes'],
          passosDetalhados: ['Execute análise completa via PowerShell se necessário'],
        },
        detectedAt: now,
        endpointUsado: '/users',
      });
    }
  } catch (e) {
    errors.push(`EXO-004: ${String(e)}`);
  }

  // EXO-005: Delegated mailbox permissions (sample)
  let delegatedCount = 0;
  for (const user of sampleUsers.slice(0, 10)) {
    try {
      const { data: permsData } = await graphFetchSafe(accessToken, `/users/${user.id}/mailFolders?$top=1`);
      if (permsData) {
        // If we can access the mailbox, check for delegates
        // Note: Full delegate check requires Exchange PowerShell
        delegatedCount++;
      }
    } catch {
      // Skip
    }
  }

  insights.push({
    id: 'EXO-005', code: 'EXO-005', category: 'email_exchange', product: 'exchange_online',
    severity: 'info',
    titulo: 'Acesso a Mailboxes (Graph API)',
    descricaoExecutiva: `Verificação de acesso realizada em ${delegatedCount} mailbox(es).`,
    riscoTecnico: 'Para análise completa de delegação, use Exchange PowerShell.',
    impactoNegocio: 'Delegações excessivas podem violar compliance.',
    scoreImpacto: 0,
    status: 'pass',
    affectedCount: delegatedCount,
    affectedEntities: [],
    remediacao: {
      productAfetado: 'exchange_online',
      portalUrl: 'https://admin.exchange.microsoft.com',
      caminhoPortal: ['Recipients', 'Mailboxes', 'Mailbox delegation'],
      passosDetalhados: ['Revise delegações via Exchange Admin Center', 'Use Get-MailboxPermission para análise detalhada'],
    },
    detectedAt: now,
    endpointUsado: '/users/{id}/mailFolders',
  });

  return { insights, errors };
}

// ========== THREATS & ACTIVITY COLLECTOR (THR-001 to THR-005) ==========

async function collectThreatsInsights(accessToken: string, now: string): Promise<CollectorResult> {
  const insights: M365Insight[] = [];
  const errors: string[] = [];

  // THR-001: Security alerts
  try {
    const { data: alertsData, error: alertsErr } = await graphFetchSafe(
      accessToken,
      '/security/alerts_v2?$top=100&$orderby=createdDateTime desc',
      { beta: true }
    );

    if (alertsData) {
      const alerts = alertsData.value || [];
      const activeAlerts = alerts.filter((a: any) => a.status !== 'resolved');
      const highSeverity = activeAlerts.filter((a: any) => a.severity === 'high');
      const mediumSeverity = activeAlerts.filter((a: any) => a.severity === 'medium');

      insights.push({
        id: 'THR-001', code: 'THR-001', category: 'threats_activity', product: 'defender',
        severity: highSeverity.length > 0 ? 'critical' : mediumSeverity.length > 5 ? 'high' : activeAlerts.length > 0 ? 'medium' : 'info',
        titulo: 'Alertas de Segurança Ativos',
        descricaoExecutiva: activeAlerts.length > 0
          ? `${activeAlerts.length} alerta(s) ativo(s): ${highSeverity.length} alto(s), ${mediumSeverity.length} médio(s).`
          : 'Nenhum alerta de segurança ativo.',
        riscoTecnico: 'Alertas indicam possíveis ameaças ativas.',
        impactoNegocio: 'Potencial comprometimento de sistemas.',
        scoreImpacto: highSeverity.length > 0 ? 8 : mediumSeverity.length > 5 ? 5 : 0,
        status: highSeverity.length > 0 || mediumSeverity.length > 5 ? 'fail' : 'pass',
        affectedCount: activeAlerts.length,
        affectedEntities: activeAlerts.slice(0, 20).map((a: any) => ({
          id: a.id,
          displayName: a.title,
          details: { severity: a.severity, status: a.status, created: a.createdDateTime }
        })),
        remediacao: {
          productAfetado: 'defender',
          portalUrl: 'https://security.microsoft.com',
          caminhoPortal: ['Incidents & alerts', 'Alerts'],
          passosDetalhados: ['Investigue cada alerta ativo', 'Priorize alertas de alta severidade', 'Documente ações de resposta'],
        },
        detectedAt: now,
        endpointUsado: '/security/alerts_v2',
      });
    } else if (alertsErr) {
      // Try v1 alerts as fallback
      try {
        const { data: alertsV1Data } = await graphFetchSafe(accessToken, '/security/alerts?$top=50');
        if (alertsV1Data) {
          const alerts = alertsV1Data.value || [];
          insights.push({
            id: 'THR-001', code: 'THR-001', category: 'threats_activity', product: 'defender',
            severity: alerts.length > 10 ? 'high' : alerts.length > 0 ? 'medium' : 'info',
            titulo: 'Alertas de Segurança',
            descricaoExecutiva: `${alerts.length} alerta(s) encontrado(s).`,
            riscoTecnico: 'Alertas indicam possíveis ameaças.',
            impactoNegocio: 'Potencial comprometimento.',
            scoreImpacto: alerts.length > 10 ? 5 : 0,
            status: alerts.length > 10 ? 'fail' : 'pass',
            affectedCount: alerts.length,
            affectedEntities: alerts.slice(0, 20).map((a: any) => ({
              id: a.id,
              displayName: a.title,
              details: { severity: a.severity }
            })),
            remediacao: {
              productAfetado: 'defender',
              portalUrl: 'https://security.microsoft.com',
              caminhoPortal: ['Incidents & alerts'],
              passosDetalhados: ['Investigue alertas', 'Tome ações de remediação'],
            },
            detectedAt: now,
            endpointUsado: '/security/alerts',
          });
        }
      } catch {
        errors.push(`THR-001: ${alertsErr}`);
      }
    }
  } catch (e) {
    errors.push(`THR-001: ${String(e)}`);
  }

  // THR-002: Sign-ins from unusual locations (last 7 days)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signInsData, error: signInsErr } = await graphFetchSafe(
      accessToken,
      `/auditLogs/signIns?$filter=createdDateTime ge ${sevenDaysAgo}&$top=200&$orderby=createdDateTime desc`
    );

    if (signInsData) {
      const signIns = signInsData.value || [];
      
      // Count sign-ins per country
      const countryCount: Record<string, number> = {};
      for (const signIn of signIns) {
        const country = signIn.location?.countryOrRegion || 'Unknown';
        countryCount[country] = (countryCount[country] || 0) + 1;
      }

      const countries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]);
      const topCountry = countries[0]?.[0] || 'BR';
      const unusualCountries = countries.filter(([c, _]) => c !== topCountry && c !== 'Unknown');

      insights.push({
        id: 'THR-002', code: 'THR-002', category: 'threats_activity', product: 'entra_id',
        severity: unusualCountries.length > 5 ? 'medium' : 'info',
        titulo: 'Sign-ins por País (7 dias)',
        descricaoExecutiva: `${signIns.length} sign-in(s) de ${countries.length} país(es). Principal: ${topCountry}.`,
        riscoTecnico: 'Sign-ins de múltiplos países podem indicar comprometimento.',
        impactoNegocio: 'Acesso não autorizado de locais incomuns.',
        scoreImpacto: unusualCountries.length > 5 ? 3 : 0,
        status: unusualCountries.length > 5 ? 'fail' : 'pass',
        affectedCount: unusualCountries.length,
        affectedEntities: countries.slice(0, 10).map(([country, count]) => ({
          id: country,
          displayName: `${country}: ${count} sign-in(s)`,
          details: { count }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Monitoring', 'Sign-ins'],
          passosDetalhados: ['Revise sign-ins de países incomuns', 'Configure Named Locations', 'Aplique políticas de CA por localização'],
        },
        detectedAt: now,
        endpointUsado: '/auditLogs/signIns',
      });

      // THR-003: Failed sign-ins
      const failedSignIns = signIns.filter((s: any) => 
        s.status?.errorCode !== 0 || s.status?.failureReason
      );

      insights.push({
        id: 'THR-003', code: 'THR-003', category: 'threats_activity', product: 'entra_id',
        severity: failedSignIns.length > 50 ? 'high' : failedSignIns.length > 20 ? 'medium' : 'info',
        titulo: 'Sign-ins com Falha (7 dias)',
        descricaoExecutiva: `${failedSignIns.length} sign-in(s) com falha detectado(s).`,
        riscoTecnico: 'Muitas falhas podem indicar ataques de brute force.',
        impactoNegocio: 'Tentativas de comprometimento de contas.',
        scoreImpacto: failedSignIns.length > 50 ? 5 : 0,
        status: failedSignIns.length > 50 ? 'fail' : 'pass',
        affectedCount: failedSignIns.length,
        affectedEntities: failedSignIns.slice(0, 20).map((s: any) => ({
          id: s.id,
          displayName: s.userDisplayName || s.userPrincipalName,
          details: { error: s.status?.failureReason, ip: s.ipAddress }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Monitoring', 'Sign-ins'],
          passosDetalhados: ['Investigue padrões de falha', 'Verifique se são ataques', 'Configure Smart Lockout'],
        },
        detectedAt: now,
        endpointUsado: '/auditLogs/signIns',
      });
    } else if (signInsErr) {
      errors.push(`THR-002/003: ${signInsErr}`);
    }
  } catch (e) {
    errors.push(`THR-002: ${String(e)}`);
  }

  // THR-004: Recent directory audit events
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: auditData, error: auditErr } = await graphFetchSafe(
      accessToken,
      `/auditLogs/directoryAudits?$filter=activityDateTime ge ${oneDayAgo}&$top=100`
    );

    if (auditData) {
      const audits = auditData.value || [];
      
      // High-risk activities
      const sensitiveActivities = audits.filter((a: any) => 
        a.activityDisplayName?.toLowerCase().includes('delete') ||
        a.activityDisplayName?.toLowerCase().includes('role') ||
        a.activityDisplayName?.toLowerCase().includes('credential') ||
        a.activityDisplayName?.toLowerCase().includes('password')
      );

      insights.push({
        id: 'THR-004', code: 'THR-004', category: 'threats_activity', product: 'entra_id',
        severity: sensitiveActivities.length > 20 ? 'medium' : 'info',
        titulo: 'Atividades Sensíveis (24h)',
        descricaoExecutiva: `${sensitiveActivities.length} atividade(s) sensível(is) de ${audits.length} evento(s) total.`,
        riscoTecnico: 'Atividades de alto risco devem ser monitoradas.',
        impactoNegocio: 'Possíveis alterações não autorizadas.',
        scoreImpacto: sensitiveActivities.length > 20 ? 3 : 0,
        status: sensitiveActivities.length > 20 ? 'fail' : 'pass',
        affectedCount: sensitiveActivities.length,
        affectedEntities: sensitiveActivities.slice(0, 20).map((a: any) => ({
          id: a.id,
          displayName: a.activityDisplayName,
          details: { initiatedBy: a.initiatedBy?.user?.displayName, time: a.activityDateTime }
        })),
        remediacao: {
          productAfetado: 'entra_id',
          portalUrl: 'https://entra.microsoft.com',
          caminhoPortal: ['Monitoring', 'Audit logs'],
          passosDetalhados: ['Revise atividades sensíveis', 'Configure alertas para ações críticas', 'Implemente SIEM'],
        },
        detectedAt: now,
        endpointUsado: '/auditLogs/directoryAudits',
      });
    } else if (auditErr) {
      errors.push(`THR-004: ${auditErr}`);
    }
  } catch (e) {
    errors.push(`THR-004: ${String(e)}`);
  }

  // THR-005: Secure Score (if available)
  try {
    const { data: secureScoreData, error: secureScoreErr } = await graphFetchSafe(
      accessToken,
      '/security/secureScores?$top=1'
    );

    if (secureScoreData) {
      const scores = secureScoreData.value || [];
      const latestScore = scores[0];

      if (latestScore) {
        const currentScore = latestScore.currentScore || 0;
        const maxScore = latestScore.maxScore || 100;
        const percentage = Math.round((currentScore / maxScore) * 100);

        insights.push({
          id: 'THR-005', code: 'THR-005', category: 'threats_activity', product: 'defender',
          severity: percentage < 40 ? 'critical' : percentage < 60 ? 'high' : percentage < 80 ? 'medium' : 'info',
          titulo: 'Microsoft Secure Score',
          descricaoExecutiva: `Secure Score: ${currentScore}/${maxScore} (${percentage}%).`,
          riscoTecnico: 'Secure Score mede a postura geral de segurança Microsoft.',
          impactoNegocio: 'Score baixo indica gaps de segurança.',
          scoreImpacto: percentage < 40 ? 7 : percentage < 60 ? 4 : 0,
          status: percentage >= 60 ? 'pass' : 'fail',
          affectedCount: 1,
          affectedEntities: [{
            id: 'secure-score',
            displayName: `${percentage}% - ${currentScore}/${maxScore}`,
            details: { current: currentScore, max: maxScore, percentage }
          }],
          remediacao: {
            productAfetado: 'defender',
            portalUrl: 'https://security.microsoft.com',
            caminhoPortal: ['Secure Score'],
            passosDetalhados: ['Revise recomendações do Secure Score', 'Implemente ações prioritárias', 'Monitore evolução do score'],
          },
          detectedAt: now,
          endpointUsado: '/security/secureScores',
        });
      }
    } else if (secureScoreErr) {
      errors.push(`THR-005: ${secureScoreErr}`);
    }
  } catch (e) {
    errors.push(`THR-005: ${String(e)}`);
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

    console.log(`[m365-security-posture] Starting comprehensive analysis for tenant: ${tenant_record_id}`);

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

    console.log(`[m365-security-posture] Running 11 collectors in parallel (60+ checks)...`);

    // Run all collectors in parallel with timeout protection
    const timeoutPromise = (promise: Promise<CollectorResult>, name: string, timeoutMs = 25000): Promise<CollectorResult> => {
      return Promise.race([
        promise,
        new Promise<CollectorResult>((_, reject) => 
          setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]).catch(e => ({ insights: [], errors: [String(e)] }));
    };

    // Call sub-functions for new categories
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const callSubFunction = async (functionName: string): Promise<CollectorResult> => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ access_token, now }),
        });
        if (!res.ok) {
          return { insights: [], errors: [`${functionName}: ${res.status} ${res.statusText}`] };
        }
        return await res.json();
      } catch (e) {
        return { insights: [], errors: [`${functionName}: ${String(e)}`] };
      }
    };

    const results = await Promise.all([
      // Original inline collectors
      timeoutPromise(collectIdentityInsights(access_token, now), 'Identity'),
      timeoutPromise(collectAdminInsights(access_token, now), 'Admin'),
      timeoutPromise(collectAuthInsights(access_token, now), 'Auth'),
      timeoutPromise(collectAppsInsights(access_token, now), 'Apps'),
      timeoutPromise(collectExchangeInsights(access_token, now), 'Exchange'),
      timeoutPromise(collectThreatsInsights(access_token, now), 'Threats'),
      // New modular collectors via sub-functions
      timeoutPromise(callSubFunction('m365-check-intune'), 'Intune', 30000),
      timeoutPromise(callSubFunction('m365-check-pim'), 'PIM', 30000),
      timeoutPromise(callSubFunction('m365-check-sharepoint'), 'SharePoint', 30000),
      timeoutPromise(callSubFunction('m365-check-teams'), 'Teams', 30000),
      timeoutPromise(callSubFunction('m365-check-defender'), 'Defender', 30000),
    ]);

    // Consolidate results
    const allInsights: M365Insight[] = [];
    const allErrors: string[] = [];

    for (const result of results) {
      allInsights.push(...result.insights);
      allErrors.push(...result.errors);
    }

    console.log(`[m365-security-posture] Collected ${allInsights.length} insights, ${allErrors.length} errors`);

    // Collect environment metrics in parallel
    const environmentMetrics = await collectEnvironmentMetrics(access_token);
    console.log(`[m365-security-posture] Environment metrics collected`);

    // Calculate category scores - now with 11 categories
    const categories = [
      'identities', 'auth_access', 'admin_privileges', 'apps_integrations', 
      'email_exchange', 'threats_activity', 'intune_devices', 'pim_governance',
      'sharepoint_onedrive', 'teams_collaboration', 'defender_security'
    ];
    const categoryLabels: Record<string, string> = {
      identities: 'Identidades',
      auth_access: 'Autenticação & Acesso',
      admin_privileges: 'Privilégios Admin',
      apps_integrations: 'Aplicações & Integrações',
      email_exchange: 'Email & Exchange',
      threats_activity: 'Ameaças & Atividades',
      intune_devices: 'Intune & Dispositivos',
      pim_governance: 'PIM & Governança',
      sharepoint_onedrive: 'SharePoint & OneDrive',
      teams_collaboration: 'Teams & Colaboração',
      defender_security: 'Defender & DLP',
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
        score: Math.max(0, 100 - totalPenalty * 3),
        criticalCount,
        highCount,
      };
    }).filter(cat => cat.count > 0); // Only return categories with insights

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

    console.log(`[m365-security-posture] Score: ${score}, Classification: ${classification}, Total insights: ${allInsights.length}`);

    return new Response(JSON.stringify({
      success: true,
      score,
      classification,
      summary,
      categoryBreakdown,
      insights: allInsights,
      environmentMetrics,
      errors: allErrors.length > 0 ? allErrors : undefined,
      tenant: { 
        id: tenant.tenant_id, 
        domain: tenant.tenant_domain || '', 
        displayName: tenant.display_name 
      },
      analyzedAt: now,
      analyzedPeriod: {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: now,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error(`[m365-security-posture] Error: ${String(e)}`);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
