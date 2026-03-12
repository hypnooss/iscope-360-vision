import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getCorsHeaders } from '../_shared/cors.ts';

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

async function graphGetText(accessToken: string, url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.warn(`Graph GET text ${url} failed: ${res.status}`);
    return null;
  }
  return await res.text();
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

function parseCsvReport(csvText: string): any[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: any = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
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

    const { data: tenant } = await supabase.from('m365_tenants').select('id, tenant_id, tenant_domain, client_id').eq('id', tenant_record_id).single();
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

    // === TEAMS ===
    // Get all teams (groups with Team resource)
    const allTeamGroups = await graphGetAllPages(
      accessToken,
      "https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/any(x:x eq 'Team')&$select=id,displayName,visibility&$top=999",
      5
    ).catch(() => []);

    const totalTeams = allTeamGroups.length;
    const publicTeams = allTeamGroups.filter((g: any) => g.visibility === 'Public').length;
    const privateTeams = allTeamGroups.filter((g: any) => g.visibility === 'Private').length;

    // Check for guest members (sample first 50 teams for performance)
    let teamsWithGuests = 0;
    const teamsToCheck = allTeamGroups.slice(0, 50);
    
    const guestChecks = await Promise.allSettled(
      teamsToCheck.map(async (team: any) => {
        const members = await graphGet(accessToken, `https://graph.microsoft.com/v1.0/groups/${team.id}/members?$select=id,userType&$top=100`);
        if (members?.value?.some((m: any) => m.userType === 'Guest')) return true;
        return false;
      })
    );
    
    teamsWithGuests = guestChecks.filter(r => r.status === 'fulfilled' && r.value === true).length;
    // Extrapolate if we sampled
    if (allTeamGroups.length > 50 && teamsToCheck.length > 0) {
      teamsWithGuests = Math.round((teamsWithGuests / teamsToCheck.length) * allTeamGroups.length);
    }

    // Channels (sample first 30 teams)
    let privateChannels = 0;
    let sharedChannels = 0;
    const channelTeams = allTeamGroups.slice(0, 30);
    
    const channelChecks = await Promise.allSettled(
      channelTeams.map(async (team: any) => {
        const channels = await graphGet(accessToken, `https://graph.microsoft.com/v1.0/teams/${team.id}/channels?$select=id,membershipType`);
        const chans = channels?.value || [];
        return {
          private: chans.filter((c: any) => c.membershipType === 'private').length,
          shared: chans.filter((c: any) => c.membershipType === 'shared').length,
        };
      })
    );
    
    channelChecks.forEach(r => {
      if (r.status === 'fulfilled') {
        privateChannels += r.value.private;
        sharedChannels += r.value.shared;
      }
    });

    // === SHAREPOINT ===
    // Get sites via search
    const allSites = await graphGetAllPages(
      accessToken,
      'https://graph.microsoft.com/v1.0/sites?$select=id,displayName,webUrl,isPersonalSite&$top=999',
      5
    ).catch(() => []);

    const totalSites = allSites.length;

    // SharePoint site usage report
    let activeSites = 0;
    let inactiveSites = 0;
    let storageUsedBytes = 0;
    let storageAllocatedBytes = 0;

    // SharePoint usage report — state data, D7 to avoid duplication across cache refreshes
    const siteUsageText = await graphGetText(
      accessToken,
      "https://graph.microsoft.com/v1.0/reports/getSharePointSiteUsageDetail(period='D7')"
    ).catch(() => null);

    if (siteUsageText) {
      console.log(`SharePoint report CSV length: ${siteUsageText.length} chars`);
      console.log(`SharePoint report first 200 chars: ${siteUsageText.substring(0, 200)}`);
      const rows = parseCsvReport(siteUsageText);
      console.log(`SharePoint report parsed: ${rows.length} rows`);
      if (rows.length > 0) {
        console.log(`SharePoint CSV headers: ${Object.keys(rows[0]).join(', ')}`);
        console.log(`SharePoint first row sample: ${JSON.stringify(rows[0]).substring(0, 300)}`);
      }
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      rows.forEach((row: any) => {
        const used = parseInt(row['Storage Used (Byte)'] || '0', 10);
        const allocated = parseInt(row['Storage Allocated (Byte)'] || '0', 10);
        if (!isNaN(used)) storageUsedBytes += used;
        if (!isNaN(allocated)) storageAllocatedBytes += allocated;
        if (row['Last Activity Date']) {
          const lastActivity = new Date(row['Last Activity Date']);
          if (lastActivity >= thirtyDaysAgo) activeSites++;
          else inactiveSites++;
        } else {
          inactiveSites++;
        }
      });
      console.log(`SharePoint storage aggregated: usedBytes=${storageUsedBytes}, allocatedBytes=${storageAllocatedBytes}, active=${activeSites}, inactive=${inactiveSites}`);
    } else {
      console.warn('SharePoint site usage report returned null - check Reports.Read.All permission on tenant');
    }

    // External sharing - check site count (requires admin-level scope)
    const externalSharingEnabled = 0; // Requires SPO admin API, placeholder

    const result = {
      success: true,
      teams: {
        total: totalTeams,
        public: publicTeams,
        private: privateTeams,
        withGuests: teamsWithGuests,
        privateChannels,
        sharedChannels,
      },
      sharepoint: {
        totalSites,
        activeSites: activeSites || totalSites, // fallback
        inactiveSites,
        externalSharingEnabled,
        totalLists: 0,
        storageUsedGB: parseFloat((storageUsedBytes / (1024 ** 3)).toFixed(2)),
        storageAllocatedGB: parseFloat((storageAllocatedBytes / (1024 ** 3)).toFixed(2)),
      },
      analyzedAt: now.toISOString(),
    };

    // Save cache
    const { error: updateError } = await supabase.from('m365_tenants').update({
      collaboration_dashboard_cache: result,
      collaboration_dashboard_cached_at: now.toISOString(),
    }).eq('id', tenant_record_id);

    if (updateError) console.error('Failed to save collaboration dashboard cache:', updateError);

    console.log('Collaboration Dashboard data aggregated and cached successfully');

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('collaboration-dashboard error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
