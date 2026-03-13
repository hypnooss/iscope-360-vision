import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { getCorsHeaders } from '../_shared/cors.ts';

// Encryption utilities
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!keyHex) throw new Error('M365_ENCRYPTION_KEY não está configurada');
  const keyBytes = fromHex(keyHex);
  return await crypto.subtle.importKey('raw', keyBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

async function decryptSecret(encrypted: string): Promise<string> {
  if (!encrypted.includes(':')) {
    try { return atob(encrypted); } catch { return encrypted; }
  }
  const [ivHex, ciphertextHex] = encrypted.split(':');
  const iv = fromHex(ivHex);
  const ciphertext = fromHex(ciphertextHex);
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, ciphertext.buffer as ArrayBuffer);
  return new TextDecoder().decode(decrypted);
}

async function getAccessToken(tenantId: string, appId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`Token error: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

async function graphGet(accessToken: string, url: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}`, ...headers },
  });
  if (!res.ok) {
    console.warn(`Graph GET ${url} failed: ${res.status}`);
    return null;
  }
  return await res.json();
}

async function graphGetAllPages(accessToken: string, url: string, maxPages = 5): Promise<any[]> {
  const allValues: any[] = [];
  let nextLink: string | null = url;
  let page = 0;
  while (nextLink && page < maxPages) {
    const data = await graphGet(accessToken, nextLink);
    if (!data) break;
    allValues.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
    page++;
  }
  return allValues;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    let userId: string | null = null;
    if (!isServiceRole) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = user.id;
    }

    const { tenant_record_id } = await req.json();
    if (!tenant_record_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_record_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tenant } = await supabase.from('m365_tenants').select('id, tenant_id, tenant_domain, client_id, entra_dashboard_cached_at').eq('id', tenant_record_id).single();
    if (!tenant) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!isServiceRole && userId) {
      const { data: hasAccess } = await supabase.rpc('has_client_access', { _user_id: userId, _client_id: tenant.client_id });
      if (!hasAccess) {
        return new Response(JSON.stringify({ success: false, error: 'Access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: globalConfig } = await supabase.from('m365_global_config').select('app_id, client_secret_encrypted').order('created_at', { ascending: false }).limit(1).single();
    if (!globalConfig) {
      return new Response(JSON.stringify({ success: false, error: 'M365 config not found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted);
    const accessToken = await getAccessToken(tenant.tenant_id, globalConfig.app_id, clientSecret);

    const now = new Date();
    // Contiguous window: from last successful execution to now (fallback: 1h)
    const periodStart = (tenant as any).entra_dashboard_cached_at
      ? new Date((tenant as any).entra_dashboard_cached_at).toISOString()
      : new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    console.log(`[entra-id-dashboard] Contiguous window: ${periodStart} → ${now.toISOString()}`);

    // Fetch all data in parallel
    const [
      usersCountData,
      guestCountData,
      disabledCountData,
      syncedCountData,
      directoryRoles,
      mfaRegistration,
      signInLogs,
      auditLogs,
      auditLogs7d,
      riskyUsersData,
    ] = await Promise.all([
      // Total users count
      graphGet(accessToken, 'https://graph.microsoft.com/v1.0/users/$count', { 'ConsistencyLevel': 'eventual', 'Accept': 'text/plain' }).catch(() => null),
      // Guest users count
      graphGet(accessToken, "https://graph.microsoft.com/v1.0/users/$count?$filter=userType eq 'Guest'", { 'ConsistencyLevel': 'eventual', 'Accept': 'text/plain' }).catch(() => null),
      // Disabled users count
      graphGet(accessToken, "https://graph.microsoft.com/v1.0/users/$count?$filter=accountEnabled eq false", { 'ConsistencyLevel': 'eventual', 'Accept': 'text/plain' }).catch(() => null),
      // On-prem synced users count
      graphGet(accessToken, "https://graph.microsoft.com/v1.0/users/$count?$filter=onPremisesSyncEnabled eq true", { 'ConsistencyLevel': 'eventual', 'Accept': 'text/plain' }).catch(() => null),
      // Directory roles with members
      graphGet(accessToken, 'https://graph.microsoft.com/v1.0/directoryRoles?$expand=members').catch(() => ({ value: [] })),
      // MFA registration details (members only, excludes guests)
      graphGetAllPages(accessToken, "https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$filter=userType eq 'member'&$top=999").catch(() => []),
      // Sign-in logs (contiguous window)
      graphGetAllPages(accessToken, `https://graph.microsoft.com/v1.0/auditLogs/signIns?$filter=createdDateTime ge ${periodStart}&$top=500&$orderby=createdDateTime desc`, 2).catch(() => []),
      // Directory audit logs (contiguous window)
      graphGetAllPages(accessToken, `https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$filter=activityDateTime ge ${periodStart}&$top=500&$orderby=activityDateTime desc`, 2).catch(() => []),
      // Directory audit logs (same contiguous window — password activity)
      graphGetAllPages(accessToken, `https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$filter=activityDateTime ge ${periodStart}&$top=500&$orderby=activityDateTime desc`, 2).catch(() => []),
      // Risky users (requires P2)
      graphGet(accessToken, 'https://graph.microsoft.com/v1.0/identityProtection/riskyUsers?$top=100').catch(() => null),
    ]);

    // For $count endpoints, the response is plain text number
    const parseCount = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseInt(val, 10) || 0;
      return 0;
    };

    const totalUsers = parseCount(usersCountData);
    const guestUsers = parseCount(guestCountData);
    const disabledUsers = parseCount(disabledCountData);
    const syncedUsers = parseCount(syncedCountData);
    const signInEnabled = totalUsers - disabledUsers;

    // Admins calculation
    const roles = directoryRoles?.value || [];
    const adminRoleNames = ['Global Administrator', 'Privileged Role Administrator', 'Security Administrator',
      'Exchange Administrator', 'SharePoint Administrator', 'User Administrator', 'Application Administrator'];
    const allAdminUserIds = new Set<string>();
    let globalAdminCount = 0;

    roles.forEach((role: any) => {
      const members = (role.members || []).filter((m: any) => m['@odata.type'] === '#microsoft.graph.user');
      if (adminRoleNames.some(ar => role.displayName?.includes(ar))) {
        members.forEach((m: any) => allAdminUserIds.add(m.id));
      }
      if (role.displayName === 'Global Administrator') {
        globalAdminCount = members.length;
      }
    });

    // MFA calculation
    const mfaUsers = mfaRegistration || [];
    const mfaEnabled = mfaUsers.filter((u: any) => {
      const methods = u.methodsRegistered || [];
      return methods.some((m: string) =>
        ['microsoftAuthenticatorPush', 'softwareOneTimePasscode', 'hardwareOneTimePasscode', 'windowsHelloForBusiness', 'passKeyDeviceBound'].includes(m)
      );
    }).length;
    const mfaDisabled = mfaUsers.length - mfaEnabled;

    // MFA method breakdown
    const mfaMethodCounts: Record<string, number> = {};
    mfaUsers.forEach((u: any) => {
      (u.methodsRegistered || []).forEach((m: string) => {
        mfaMethodCounts[m] = (mfaMethodCounts[m] || 0) + 1;
      });
    });

    // Risks
    const riskyUsers = riskyUsersData?.value || [];
    const riskyAtRisk = riskyUsers.filter((u: any) => u.riskState === 'atRisk').length;
    const riskyConfirmedCompromised = riskyUsers.filter((u: any) => u.riskState === 'confirmedCompromised').length;

    // Sign-in activity aggregation
    const successLogins = signInLogs.filter((l: any) => !l.status?.errorCode || l.status.errorCode === 0).length;
    const failedLogins = signInLogs.filter((l: any) => l.status?.errorCode && l.status.errorCode !== 0).length;
    const mfaRequiredLogins = signInLogs.filter((l: any) =>
      l.conditionalAccessStatus === 'success' && l.authenticationRequirement === 'multiFactorAuthentication'
    ).length;
    const blockedLogins = signInLogs.filter((l: any) =>
      l.conditionalAccessStatus === 'failure' || l.status?.errorCode === 53003
    ).length;

    // Aggregate sign-in logs by country
    const successByCountry: Record<string, number> = {};
    const failedByCountry: Record<string, number> = {};
    signInLogs.forEach((l: any) => {
      const country = l.location?.countryOrRegion;
      if (!country) return;
      if (!l.status?.errorCode || l.status.errorCode === 0) {
        successByCountry[country] = (successByCountry[country] || 0) + 1;
      } else {
        failedByCountry[country] = (failedByCountry[country] || 0) + 1;
      }
    });
    const loginCountriesSuccess = Object.entries(successByCountry)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const loginCountriesFailed = Object.entries(failedByCountry)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Audit activity aggregation (30 days)
    const userChangeActivities: Record<string, string[]> = {
      'Update user': [],
      'Add user': [],
      'Enable account': [],
      'Disable account': [],
      'Delete user': [],
    };

    auditLogs.forEach((log: any) => {
      const activity = log.activityDisplayName;
      if (activity in userChangeActivities) {
        userChangeActivities[activity].push(log.id);
      }
    });

    // Password activity (7 days)
    const passwordActivities = {
      resets: 0,
      forcedChanges: 0,
      selfService: 0,
    };

    auditLogs7d.forEach((log: any) => {
      const activity = log.activityDisplayName;
      if (activity === 'Reset password (by admin)' || activity === 'Reset user password') {
        passwordActivities.resets++;
      } else if (activity === 'Change password (self-service)' || activity === 'Change user password') {
        passwordActivities.selfService++;
      } else if (activity === 'Force change password') {
        passwordActivities.forcedChanges++;
      }
    });

    const result = {
      success: true,
      users: {
        total: totalUsers,
        signInEnabled,
        disabled: disabledUsers,
        guests: guestUsers,
        onPremSynced: syncedUsers,
      },
      admins: {
        total: allAdminUserIds.size,
        globalAdmins: globalAdminCount,
      },
      mfa: {
        total: mfaUsers.length,
        enabled: mfaEnabled,
        disabled: mfaDisabled,
        methodBreakdown: mfaMethodCounts,
      },
      risks: {
        riskyUsers: riskyUsers.length,
        atRisk: riskyAtRisk,
        compromised: riskyConfirmedCompromised,
      },
      loginActivity: {
        total: signInLogs.length,
        success: successLogins,
        failed: failedLogins,
        mfaRequired: mfaRequiredLogins,
        blocked: blockedLogins,
      },
      userChanges: {
        updated: userChangeActivities['Update user'].length,
        new: userChangeActivities['Add user'].length,
        enabled: userChangeActivities['Enable account'].length,
        disabled: userChangeActivities['Disable account'].length,
        deleted: userChangeActivities['Delete user'].length,
      },
      passwordActivity: {
        resets: passwordActivities.resets,
        forcedChanges: passwordActivities.forcedChanges,
        selfService: passwordActivities.selfService,
      },
      loginCountriesSuccess,
      loginCountriesFailed,
      analyzedAt: now.toISOString(),
      periodStart,
      periodEnd: now.toISOString(),
    };

    // Save snapshot to m365_dashboard_snapshots
    const { error: snapError } = await supabase.from('m365_dashboard_snapshots').insert({
      tenant_record_id,
      client_id: tenant.client_id,
      dashboard_type: 'entra_id',
      data: result,
      period_start: periodStart,
      period_end: now.toISOString(),
    });
    if (snapError) console.error('Failed to save entra dashboard snapshot:', snapError);

    // Save legacy cache (backward compat)
    const { error: updateError } = await supabase.from('m365_tenants').update({
      entra_dashboard_cache: result,
      entra_dashboard_cached_at: now.toISOString(),
    }).eq('id', tenant_record_id);
    if (updateError) console.error('Failed to save entra dashboard cache:', updateError);

    console.log('Entra ID Dashboard data aggregated and cached successfully');

    return new Response(JSON.stringify({ ...result, success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('entra-id-dashboard error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
