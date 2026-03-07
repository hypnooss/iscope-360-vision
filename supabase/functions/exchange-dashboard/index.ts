import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/plain')) {
    return await res.text();
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

// Parse CSV report data from Graph reporting endpoints
function parseCsvReport(csvText: string): any[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Remove BOM and clean headers
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

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    const { data: hasAccess } = await supabase.rpc('has_client_access', { _user_id: user.id, _client_id: tenant.client_id });
    if (!hasAccess) {
      return new Response(JSON.stringify({ success: false, error: 'Access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: globalConfig } = await supabase.from('m365_global_config').select('app_id, client_secret_encrypted').order('created_at', { ascending: false }).limit(1).single();
    if (!globalConfig) {
      return new Response(JSON.stringify({ success: false, error: 'M365 config not found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientSecret = await decryptSecret(globalConfig.client_secret_encrypted);
    const accessToken = await getAccessToken(tenant.tenant_id, globalConfig.app_id, clientSecret);

    const now = new Date();

    // Fetch mailbox usage report (CSV) and transport rules in parallel
    const [
      mailboxUsageCsv,
      emailActivityCsv,
      transportRules,
    ] = await Promise.all([
      // Mailbox usage detail (CSV report)
      graphGet(accessToken, "https://graph.microsoft.com/v1.0/reports/getMailboxUsageDetail(period='D30')", { 'Accept': 'application/json' }).catch(() => null),
      // Email activity counts
      graphGet(accessToken, "https://graph.microsoft.com/v1.0/reports/getEmailActivityCounts(period='D30')", { 'Accept': 'application/json' }).catch(() => null),
      // Transport rules (mail flow rules) - inbox rules with forwarding
      graphGetAllPages(accessToken, 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mailboxSettings&$top=999', 3).catch(() => []),
    ]);

    // Parse mailbox usage data
    let totalMailboxes = 0;
    let overQuota = 0;
    let newLast30d = 0;
    let notLoggedIn30d = 0;

    if (mailboxUsageCsv && typeof mailboxUsageCsv === 'string') {
      const rows = parseCsvReport(mailboxUsageCsv);
      totalMailboxes = rows.length;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      rows.forEach((row: any) => {
        if (row['Storage Used (Byte)'] && row['Prohibit Send/Receive Quota (Byte)']) {
          const used = parseInt(row['Storage Used (Byte)'], 10) || 0;
          const quota = parseInt(row['Prohibit Send/Receive Quota (Byte)'], 10) || 0;
          if (quota > 0 && used >= quota * 0.9) overQuota++;
        }
        if (row['Created Date']) {
          const created = new Date(row['Created Date']);
          if (created >= thirtyDaysAgo) newLast30d++;
        }
        if (row['Last Activity Date']) {
          const lastActivity = new Date(row['Last Activity Date']);
          if (lastActivity < thirtyDaysAgo) notLoggedIn30d++;
        } else {
          notLoggedIn30d++;
        }
      });
    } else if (mailboxUsageCsv?.value) {
      // JSON format
      const rows = mailboxUsageCsv.value || [];
      totalMailboxes = rows.length;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      rows.forEach((row: any) => {
        const used = row.storageUsedInBytes || 0;
        const quota = row.prohibitSendReceiveQuotaInBytes || 0;
        if (quota > 0 && used >= quota * 0.9) overQuota++;
        if (row.createdDateTime) {
          const created = new Date(row.createdDateTime);
          if (created >= thirtyDaysAgo) newLast30d++;
        }
        if (row.lastActivityDate) {
          const lastActivity = new Date(row.lastActivityDate);
          if (lastActivity < thirtyDaysAgo) notLoggedIn30d++;
        } else {
          notLoggedIn30d++;
        }
      });
    }

    // Forwarding and auto-reply
    let forwardingEnabled = 0;
    let autoReplyExternal = 0;

    transportRules.forEach((user: any) => {
      const settings = user.mailboxSettings;
      if (settings) {
        if (settings.automaticRepliesSetting?.status === 'alwaysEnabled' || settings.automaticRepliesSetting?.status === 'scheduled') {
          if (settings.automaticRepliesSetting?.externalAudience === 'all' || settings.automaticRepliesSetting?.externalAudience === 'contactsOnly') {
            autoReplyExternal++;
          }
        }
      }
    });

    // Email traffic
    let sent = 0;
    let received = 0;
    
    if (emailActivityCsv && typeof emailActivityCsv === 'string') {
      const rows = parseCsvReport(emailActivityCsv);
      rows.forEach((row: any) => {
        sent += parseInt(row['Send Count'] || '0', 10);
        received += parseInt(row['Receive Count'] || '0', 10);
      });
    } else if (emailActivityCsv?.value) {
      emailActivityCsv.value.forEach((row: any) => {
        sent += row.sendCount || 0;
        received += row.receiveCount || 0;
      });
    }

    const result = {
      success: true,
      mailboxes: {
        total: totalMailboxes,
        overQuota,
        forwardingEnabled,
        autoReplyExternal,
        newLast30d,
        notLoggedIn30d,
      },
      traffic: { sent, received },
      security: {
        maliciousInbound: 0,
        phishing: 0,
        malware: 0,
        spam: 0,
      },
      analyzedAt: now.toISOString(),
    };

    // Save cache
    const { error: updateError } = await supabase.from('m365_tenants').update({
      exchange_dashboard_cache: result,
      exchange_dashboard_cached_at: now.toISOString(),
    }).eq('id', tenant_record_id);

    if (updateError) console.error('Failed to save exchange dashboard cache:', updateError);

    console.log('Exchange Dashboard data aggregated and cached successfully');

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('exchange-dashboard error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
