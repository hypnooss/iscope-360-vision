import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Types
// ============================================

interface M365AnalyzerInsight {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  details?: string;
  affectedUsers?: string[];
  count?: number;
  recommendation?: string;
  metadata?: Record<string, any>;
}

interface GraphTokenResult {
  access_token: string;
  expires_in: number;
}

// ============================================
// Graph API Helper
// ============================================

async function getGraphToken(supabase: any, tenantRecordId: string): Promise<string | null> {
  // Get tenant info
  const { data: tenant } = await supabase
    .from('m365_tenants')
    .select('tenant_id')
    .eq('id', tenantRecordId)
    .single();

  if (!tenant) return null;

  // Get credentials
  const { data: cred } = await supabase
    .from('m365_app_credentials')
    .select('azure_app_id, client_secret_encrypted, auth_type')
    .eq('tenant_record_id', tenantRecordId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!cred || !cred.client_secret_encrypted) return null;

  // Decrypt secret
  const encryptionKey = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!encryptionKey) {
    console.error('[m365-analyzer] M365_ENCRYPTION_KEY not configured');
    return null;
  }

  let clientSecret: string;
  try {
    const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const combined = Uint8Array.from(atob(cred.client_secret_encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    clientSecret = new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('[m365-analyzer] Failed to decrypt client secret:', e);
    return null;
  }

  // Get token
  const tokenUrl = `https://login.microsoftonline.com/${tenant.tenant_id}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cred.azure_app_id,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) {
    console.error('[m365-analyzer] Token request failed:', await res.text());
    return null;
  }

  const tokenData: GraphTokenResult = await res.json();
  return tokenData.access_token;
}

async function graphGet(token: string, url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual',
      },
    });
    if (!res.ok) {
      console.warn(`[m365-analyzer] Graph API ${res.status}: ${url}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[m365-analyzer] Graph fetch error for ${url}:`, e);
    return null;
  }
}

// ============================================
// Module 1: Phishing & Threats
// ============================================

function analyzePhishingThreats(emailActivity: any[], threatData: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { totalPhishing: 0, topAttackedUsers: [], topSenderDomains: [] };

  // Analyze threat protection data if available
  if (Array.isArray(threatData) && threatData.length > 0) {
    const phishingMessages = threatData.filter((t: any) =>
      (t.verdictSource || '').toLowerCase().includes('phish') ||
      (t.threatType || '').toLowerCase().includes('phish') ||
      (t.deliveryAction || '').toLowerCase().includes('blocked')
    );

    metrics.totalPhishing = phishingMessages.length;

    // Top attacked users
    const userMap: Record<string, number> = {};
    for (const msg of phishingMessages) {
      const user = msg.recipientEmailAddress || msg.userPrincipalName || 'unknown';
      userMap[user] = (userMap[user] || 0) + 1;
    }
    metrics.topAttackedUsers = Object.entries(userMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([user, count]) => ({ user, count }));

    // Top sender domains
    const domainMap: Record<string, number> = {};
    for (const msg of phishingMessages) {
      const sender = msg.senderAddress || msg.senderFromAddress || '';
      const domain = sender.includes('@') ? sender.split('@')[1] : sender;
      if (domain) domainMap[domain] = (domainMap[domain] || 0) + 1;
    }
    metrics.topSenderDomains = Object.entries(domainMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    if (phishingMessages.length > 50) {
      insights.push({
        id: 'high_phishing_volume',
        category: 'phishing_threats',
        name: 'Alto Volume de Phishing',
        description: `${phishingMessages.length} emails de phishing detectados no período de análise`,
        severity: phishingMessages.length > 200 ? 'critical' : 'high',
        count: phishingMessages.length,
        recommendation: 'Revise as políticas de anti-phishing e considere treinamento de conscientização.',
      });
    }

    // Repeated target
    for (const [user, count] of Object.entries(userMap)) {
      if (count >= 10) {
        insights.push({
          id: `repeated_target_${user.replace(/[^a-z0-9]/gi, '_')}`,
          category: 'phishing_threats',
          name: 'Usuário Frequentemente Atacado',
          description: `${user} recebeu ${count} tentativas de phishing`,
          severity: count >= 30 ? 'high' : 'medium',
          affectedUsers: [user],
          count,
          recommendation: 'Investigue se o email está em listas de spam e reforce a proteção.',
        });
      }
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 2: Mailbox Capacity
// ============================================

function analyzeMailboxCapacity(mailboxUsage: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { above80: 0, above90: 0, totalMailboxes: 0 };

  if (!Array.isArray(mailboxUsage)) return { insights, metrics };

  metrics.totalMailboxes = mailboxUsage.length;
  const critical: string[] = [];
  const warning: string[] = [];

  for (const mb of mailboxUsage) {
    const used = mb.storageUsedInBytes || 0;
    const quota = mb.prohibitSendReceiveQuotaInBytes || mb.issueWarningQuotaInBytes || 53687091200; // 50GB default
    if (quota === 0) continue;

    const pct = (used / quota) * 100;
    if (pct >= 90) {
      critical.push(mb.userPrincipalName || mb.displayName || 'unknown');
      metrics.above90++;
    } else if (pct >= 80) {
      warning.push(mb.userPrincipalName || mb.displayName || 'unknown');
      metrics.above80++;
    }
  }

  if (critical.length > 0) {
    insights.push({
      id: 'mailbox_critical_capacity',
      category: 'mailbox_capacity',
      name: 'Caixas Postais Acima de 90%',
      description: `${critical.length} caixa(s) postal(is) estão acima de 90% da capacidade`,
      severity: 'critical',
      affectedUsers: critical.slice(0, 20),
      count: critical.length,
      recommendation: 'Solicite limpeza ou aumente a cota dessas caixas postais.',
    });
  }

  if (warning.length > 0) {
    insights.push({
      id: 'mailbox_warning_capacity',
      category: 'mailbox_capacity',
      name: 'Caixas Postais Acima de 80%',
      description: `${warning.length} caixa(s) postal(is) estão entre 80-90% da capacidade`,
      severity: 'medium',
      affectedUsers: warning.slice(0, 20),
      count: warning.length,
      recommendation: 'Monitore essas caixas para evitar interrupção de serviço.',
    });
  }

  return { insights, metrics };
}

// ============================================
// Module 3: Behavioral Baseline
// ============================================

function analyzeBehavioralBaseline(
  emailActivity: any[],
  baselines: any[]
): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { anomalousUsers: 0, totalAnalyzed: 0 };

  if (!Array.isArray(emailActivity)) return { insights, metrics };

  const baselineMap: Record<string, any> = {};
  if (Array.isArray(baselines)) {
    for (const b of baselines) {
      baselineMap[b.user_principal_name] = b;
    }
  }

  metrics.totalAnalyzed = emailActivity.length;

  for (const activity of emailActivity) {
    const user = activity.userPrincipalName || '';
    const sentCount = activity.sendCount || 0;
    const receivedCount = activity.receiveCount || 0;
    const baseline = baselineMap[user];

    if (!baseline) continue;

    const avgSent = parseFloat(baseline.avg_sent_daily) || 0;
    const avgReceived = parseFloat(baseline.avg_received_daily) || 0;

    // Detect send anomaly (5x+ above baseline)
    if (avgSent > 0 && sentCount > avgSent * 5) {
      const deviation = Math.round((sentCount / avgSent) * 100);
      metrics.anomalousUsers++;
      insights.push({
        id: `send_anomaly_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'behavioral_baseline',
        name: 'Envio Anômalo de Emails',
        description: `${user} enviou ${sentCount} emails (${deviation}% da média diária de ${Math.round(avgSent)})`,
        severity: deviation >= 500 ? 'critical' : deviation >= 200 ? 'high' : 'medium',
        affectedUsers: [user],
        count: sentCount,
        metadata: { avgSent, deviation },
        recommendation: 'Verifique se é atividade legítima ou possível comprometimento de conta.',
      });
    }

    // Detect receive anomaly (5x+ above baseline)
    if (avgReceived > 0 && receivedCount > avgReceived * 5) {
      const deviation = Math.round((receivedCount / avgReceived) * 100);
      insights.push({
        id: `receive_anomaly_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'behavioral_baseline',
        name: 'Recebimento Anômalo de Emails',
        description: `${user} recebeu ${receivedCount} emails (${deviation}% da média diária de ${Math.round(avgReceived)})`,
        severity: deviation >= 500 ? 'high' : 'medium',
        affectedUsers: [user],
        count: receivedCount,
        recommendation: 'Investigue possível ataque dirigido ou spam massivo.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 4: Account Compromise Detection
// ============================================

function analyzeAccountCompromise(
  signInLogs: any[],
  emailActivity: any[],
  inboxRules: any[]
): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { suspiciousSignIns: 0, potentiallyCompromised: 0 };

  if (!Array.isArray(signInLogs)) return { insights, metrics };

  // Find suspicious sign-ins (from unusual locations or failed followed by success)
  const suspiciousUsers = new Set<string>();
  const userLocations: Record<string, Set<string>> = {};

  for (const log of signInLogs) {
    const user = log.userPrincipalName || '';
    const country = log.location?.countryOrRegion || '';
    const status = log.status?.errorCode === 0 ? 'success' : 'failure';
    const riskLevel = (log.riskLevelDuringSignIn || '').toLowerCase();

    if (!userLocations[user]) userLocations[user] = new Set();
    if (country) userLocations[user].add(country);

    if (riskLevel === 'high' || riskLevel === 'medium') {
      suspiciousUsers.add(user);
      metrics.suspiciousSignIns++;
    }
  }

  // Cross-reference: suspicious sign-in + high email volume
  const activityMap: Record<string, number> = {};
  if (Array.isArray(emailActivity)) {
    for (const a of emailActivity) {
      activityMap[a.userPrincipalName || ''] = a.sendCount || 0;
    }
  }

  // Cross-reference: suspicious sign-in + inbox rule creation
  const ruleUsers = new Set<string>();
  if (Array.isArray(inboxRules)) {
    for (const rule of inboxRules) {
      if (rule.userPrincipalName) ruleUsers.add(rule.userPrincipalName);
    }
  }

  for (const user of suspiciousUsers) {
    const highSend = (activityMap[user] || 0) > 50;
    const hasNewRule = ruleUsers.has(user);
    const multiCountry = (userLocations[user]?.size || 0) > 2;

    if (highSend || hasNewRule || multiCountry) {
      metrics.potentiallyCompromised++;
      const reasons: string[] = [];
      if (highSend) reasons.push(`envio massivo (${activityMap[user]} emails)`);
      if (hasNewRule) reasons.push('criação de regra de inbox');
      if (multiCountry) reasons.push(`login de ${userLocations[user]?.size} países`);

      insights.push({
        id: `compromise_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'account_compromise',
        name: 'Alta Probabilidade de Conta Comprometida',
        description: `${user}: login suspeito correlacionado com ${reasons.join(', ')}`,
        severity: 'critical',
        affectedUsers: [user],
        metadata: { highSend, hasNewRule, multiCountry, countries: [...(userLocations[user] || [])] },
        recommendation: 'Bloqueie a conta imediatamente, revogue sessões ativas e investigue atividade recente.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 5: Suspicious Rules
// ============================================

function analyzeSuspiciousRules(auditLogs: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { suspiciousRules: 0 };

  if (!Array.isArray(auditLogs)) return { insights, metrics };

  for (const log of auditLogs) {
    const activity = (log.activityDisplayName || log.operationName || '').toLowerCase();
    const target = log.targetResources?.[0]?.displayName || '';
    const user = log.initiatedBy?.user?.userPrincipalName || log.userId || '';

    // Detect inbox rule creation/modification
    if (activity.includes('inbox rule') || activity.includes('transport rule') || activity.includes('new-inboxrule') || activity.includes('set-inboxrule')) {
      // Check for forwarding to external domain
      const modifiedProps = log.targetResources?.[0]?.modifiedProperties || [];
      let isForward = false;
      let forwardTo = '';

      for (const prop of modifiedProps) {
        const name = (prop.displayName || '').toLowerCase();
        const val = (prop.newValue || '').toLowerCase();
        if (name.includes('forwardto') || name.includes('redirectto') || name.includes('forward')) {
          isForward = true;
          forwardTo = prop.newValue || '';
        }
        if (name.includes('deleteMessage') && val === 'true') {
          insights.push({
            id: `delete_rule_${user.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`,
            category: 'suspicious_rules',
            name: 'Regra de Exclusão Automática',
            description: `${user} criou regra que deleta emails automaticamente: ${target}`,
            severity: 'high',
            affectedUsers: [user],
            recommendation: 'Investigue a finalidade dessa regra. Pode ser tentativa de ocultar atividade.',
          });
          metrics.suspiciousRules++;
        }
      }

      if (isForward) {
        insights.push({
          id: `forward_rule_${user.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`,
          category: 'suspicious_rules',
          name: 'Regra de Redirecionamento Externo',
          description: `${user} criou regra de forward: ${target} → ${forwardTo}`,
          severity: 'critical',
          affectedUsers: [user],
          metadata: { forwardTo },
          recommendation: 'Verifique imediatamente se o redirecionamento é autorizado.',
        });
        metrics.suspiciousRules++;
      }
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 6: Exfiltration Detection
// ============================================

function analyzeExfiltration(emailActivity: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { exfiltrationRisk: 0 };

  if (!Array.isArray(emailActivity)) return { insights, metrics };

  // Detect high external send volume
  for (const activity of emailActivity) {
    const user = activity.userPrincipalName || '';
    const externalSent = activity.sendCount || 0; // Simplified: in real impl would filter by external recipients

    if (externalSent > 100) {
      metrics.exfiltrationRisk++;
      insights.push({
        id: `exfiltration_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'exfiltration',
        name: 'Possível Exfiltração de Dados',
        description: `${user} enviou ${externalSent} emails com alto volume no período`,
        severity: externalSent > 500 ? 'critical' : 'high',
        affectedUsers: [user],
        count: externalSent,
        recommendation: 'Verifique se o volume de envio externo é compatível com a função do usuário.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 7: Operational Risks
// ============================================

function analyzeOperationalRisks(signInLogs: any[], auditLogs: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { legacyAuthUsers: 0, fullAccessGrants: 0 };

  // Detect legacy authentication
  if (Array.isArray(signInLogs)) {
    const legacyUsers = new Set<string>();
    for (const log of signInLogs) {
      const clientApp = (log.clientAppUsed || '').toLowerCase();
      if (clientApp.includes('smtp') || clientApp.includes('imap') || clientApp.includes('pop3') || clientApp.includes('other')) {
        legacyUsers.add(log.userPrincipalName || '');
      }
    }

    if (legacyUsers.size > 0) {
      metrics.legacyAuthUsers = legacyUsers.size;
      insights.push({
        id: 'legacy_auth_detected',
        category: 'operational_risks',
        name: 'Protocolo Legado em Uso',
        description: `${legacyUsers.size} usuário(s) utilizando autenticação via protocolo legado (SMTP/IMAP/POP3)`,
        severity: 'medium',
        affectedUsers: [...legacyUsers].slice(0, 20),
        count: legacyUsers.size,
        recommendation: 'Desabilite protocolos legados e migre para autenticação moderna.',
      });
    }
  }

  // Detect FullAccess mailbox permission grants
  if (Array.isArray(auditLogs)) {
    for (const log of auditLogs) {
      const activity = (log.activityDisplayName || '').toLowerCase();
      if (activity.includes('mailbox permission') || activity.includes('fullaccess') || activity.includes('add-mailboxpermission')) {
        const user = log.initiatedBy?.user?.userPrincipalName || '';
        metrics.fullAccessGrants++;
        insights.push({
          id: `fullaccess_${user.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`,
          category: 'operational_risks',
          name: 'Permissão FullAccess Concedida',
          description: `${user} concedeu permissão FullAccess a uma caixa postal`,
          severity: 'high',
          affectedUsers: [user],
          recommendation: 'Verifique se a concessão de acesso completo à caixa postal é autorizada.',
        });
      }
    }
  }

  return { insights, metrics };
}

// ============================================
// Score Calculator
// ============================================

function calculateScore(insights: M365AnalyzerInsight[]): { score: number; summary: Record<string, number> } {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const insight of insights) {
    summary[insight.severity]++;
  }

  // Score: start at 100, deduct per severity
  let score = 100;
  score -= summary.critical * 15;
  score -= summary.high * 8;
  score -= summary.medium * 3;
  score -= summary.low * 1;
  score = Math.max(0, Math.min(100, score));

  return { score, summary };
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { snapshot_id, raw_data } = await req.json();

    if (!snapshot_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'snapshot_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[m365-analyzer] Processing snapshot: ${snapshot_id}, has raw_data: ${!!raw_data}`);

    // Fetch snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('m365_analyzer_snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .single();

    if (snapError || !snapshot) {
      return new Response(
        JSON.stringify({ success: false, error: 'Snapshot not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('m365_analyzer_snapshots')
      .update({ status: 'processing' })
      .eq('id', snapshot_id);

    let emailActivity: any[] = [];
    let mailboxUsage: any[] = [];
    let signInLogs: any[] = [];
    let auditLogs: any[] = [];
    let threatData: any[] = [];
    let inboxRules: any[] = [];
    let dataSource = 'none';

    // ── Strategy: try raw_data from agent first, then Graph API fallback ──
    if (raw_data && typeof raw_data === 'object') {
      console.log('[m365-analyzer] Using raw_data from agent');
      dataSource = 'agent';

      // Extract Graph API data from agent steps (collected via edge_function steps in blueprint)
      const extractArray = (key: string): any[] => {
        const step = raw_data[key];
        if (!step) return [];
        // Step data can be { data: [...] }, { value: [...] }, or direct array
        if (Array.isArray(step)) return step;
        if (typeof step === 'object') {
          if (Array.isArray(step.data)) return step.data;
          if (Array.isArray(step.value)) return step.value;
          if (Array.isArray(step.results)) return step.results;
        }
        return [];
      };

      // Map agent step IDs to analyzer variables
      signInLogs = extractArray('signin_logs') || extractArray('failed_signins');
      auditLogs = extractArray('audit_logs');
      
      // Exchange PowerShell data mapped to analyzer concepts
      const forwardingData = extractArray('exo_mailbox_forwarding');
      const transportRules = extractArray('exo_transport_rules');
      
      // Build inbox rules from forwarding + transport data for suspicious rules module
      inboxRules = [
        ...forwardingData.map((f: any) => ({
          userPrincipalName: f.PrimarySmtpAddress || f.DisplayName,
          ruleName: 'Mailbox Forwarding',
          forwardTo: f.ForwardingSmtpAddress || f.ForwardingAddress || '',
        })),
      ];

      // Build audit-like entries from transport rules for suspicious rules detection
      for (const rule of transportRules) {
        if (rule.RedirectMessageTo || rule.CopyTo || rule.BlindCopyTo || rule.DeleteMessage) {
          auditLogs.push({
            activityDisplayName: 'Transport Rule',
            targetResources: [{
              displayName: rule.Name || 'Unknown',
              modifiedProperties: [
                ...(rule.RedirectMessageTo ? [{ displayName: 'forwardTo', newValue: String(rule.RedirectMessageTo) }] : []),
                ...(rule.DeleteMessage ? [{ displayName: 'deleteMessage', newValue: 'true' }] : []),
              ],
            }],
            initiatedBy: { user: { userPrincipalName: 'TransportRule' } },
          });
        }
      }

      console.log(`[m365-analyzer] Agent data mapped: signIns=${signInLogs.length}, audits=${auditLogs.length}, forwarding=${forwardingData.length}, transportRules=${transportRules.length}`);
    }

    // If no data from agent (or minimal data), try Graph API directly
    if (dataSource === 'none' || (signInLogs.length === 0 && auditLogs.length === 0 && emailActivity.length === 0)) {
      const token = await getGraphToken(supabase, snapshot.tenant_record_id);
      if (token) {
        console.log('[m365-analyzer] Got Graph API token, collecting data...');
        dataSource = dataSource === 'agent' ? 'hybrid' : 'graph_api';

        const periodFilter = snapshot.period_start
          ? `&$filter=createdDateTime ge ${snapshot.period_start}`
          : '';

        const [
          emailActivityData,
          mailboxUsageData,
          signInLogsData,
          auditLogsData,
          threatStatusData,
        ] = await Promise.all([
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getEmailActivityUserDetail(period=\'D1\')'),
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getMailboxUsageDetail(period=\'D1\')'),
          graphGet(token, `https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=500${periodFilter}`),
          graphGet(token, `https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$top=500${periodFilter}`),
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getEmailActivityUserDetail(period=\'D1\')'),
        ]);

        if (emailActivity.length === 0) emailActivity = Array.isArray(emailActivityData?.value) ? emailActivityData.value : [];
        if (mailboxUsage.length === 0) mailboxUsage = Array.isArray(mailboxUsageData?.value) ? mailboxUsageData.value : [];
        if (signInLogs.length === 0) signInLogs = Array.isArray(signInLogsData?.value) ? signInLogsData.value : [];
        if (auditLogs.length === 0) auditLogs = Array.isArray(auditLogsData?.value) ? auditLogsData.value : [];
        if (threatData.length === 0) threatData = Array.isArray(threatStatusData?.value) ? threatStatusData.value : [];
      } else if (dataSource === 'none') {
        // No agent data AND no Graph API token — fail
        console.error('[m365-analyzer] No data source available: no raw_data and Graph API token failed');
        await supabase
          .from('m365_analyzer_snapshots')
          .update({ status: 'failed', insights: [], metrics: { error: 'No data source: Graph API token failed and no agent data' } })
          .eq('id', snapshot_id);
        return new Response(
          JSON.stringify({ success: false, error: 'No data source available' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('[m365-analyzer] Graph API token failed, proceeding with agent data only');
      }
    }

    console.log(`[m365-analyzer] Data ready (source=${dataSource}): emails=${emailActivity.length}, mailboxes=${mailboxUsage.length}, signIns=${signInLogs.length}, audits=${auditLogs.length}`);

    // Fetch existing baselines
    const { data: baselines } = await supabase
      .from('m365_user_baselines')
      .select('*')
      .eq('tenant_record_id', snapshot.tenant_record_id);

    // ── Run analysis modules ──
    const allInsights: M365AnalyzerInsight[] = [];
    const allMetrics: Record<string, any> = {};

    const phishing = analyzePhishingThreats(emailActivity, threatData);
    allInsights.push(...phishing.insights);
    allMetrics.phishing = phishing.metrics;

    const mailbox = analyzeMailboxCapacity(mailboxUsage);
    allInsights.push(...mailbox.insights);
    allMetrics.mailbox = mailbox.metrics;

    const behavioral = analyzeBehavioralBaseline(emailActivity, baselines || []);
    allInsights.push(...behavioral.insights);
    allMetrics.behavioral = behavioral.metrics;

    const compromise = analyzeAccountCompromise(signInLogs, emailActivity, inboxRules);
    allInsights.push(...compromise.insights);
    allMetrics.compromise = compromise.metrics;

    const rules = analyzeSuspiciousRules(auditLogs);
    allInsights.push(...rules.insights);
    allMetrics.rules = rules.metrics;

    const exfiltration = analyzeExfiltration(emailActivity);
    allInsights.push(...exfiltration.insights);
    allMetrics.exfiltration = exfiltration.metrics;

    const operational = analyzeOperationalRisks(signInLogs, auditLogs);
    allInsights.push(...operational.insights);
    allMetrics.operational = operational.metrics;

    allMetrics.dataSource = dataSource;

    // Calculate score
    const { score, summary } = calculateScore(allInsights);

    console.log(`[m365-analyzer] Analysis complete. Score: ${score}, Insights: ${allInsights.length}, Summary: ${JSON.stringify(summary)}`);

    // Update snapshot with results
    await supabase
      .from('m365_analyzer_snapshots')
      .update({
        status: 'completed',
        score,
        summary,
        insights: allInsights,
        metrics: allMetrics,
      })
      .eq('id', snapshot_id);

    // Update baselines (simple: upsert current activity as baseline if first time)
    if (emailActivity.length > 0 && (!baselines || baselines.length === 0)) {
      console.log('[m365-analyzer] Building initial baselines...');
      const baselineRows = emailActivity
        .filter((a: any) => a.userPrincipalName)
        .map((a: any) => ({
          tenant_record_id: snapshot.tenant_record_id,
          user_principal_name: a.userPrincipalName,
          avg_sent_daily: a.sendCount || 0,
          avg_received_daily: a.receiveCount || 0,
          avg_recipients_per_msg: 0,
          typical_send_hours: [],
          baseline_date: new Date().toISOString().split('T')[0],
          sample_days: 1,
        }));

      if (baselineRows.length > 0) {
        await supabase
          .from('m365_user_baselines')
          .upsert(baselineRows, { onConflict: 'tenant_record_id,user_principal_name' });
        console.log(`[m365-analyzer] Created ${baselineRows.length} baseline entries`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot_id,
        score,
        summary,
        insights_count: allInsights.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[m365-analyzer] Error:', error);

    // Mark snapshot as failed if we have a snapshot_id
    try {
      const body = await req.clone().json().catch(() => ({}));
      const failSnapshotId = body?.snapshot_id;
      if (failSnapshotId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);
        await sbAdmin
          .from('m365_analyzer_snapshots')
          .update({ status: 'failed', metrics: { error: String(error) } })
          .eq('id', failSnapshotId)
          .in('status', ['pending', 'processing']);
        console.log(`[m365-analyzer] Marked snapshot ${failSnapshotId} as failed`);
      }
    } catch (cleanupErr) {
      console.error('[m365-analyzer] Failed to mark snapshot as failed:', cleanupErr);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
