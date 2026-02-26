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
// Robust normalizer for step results
// ============================================

function normalizeStepData(raw: unknown): any[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return normalizeStepData(JSON.parse(raw)); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, any>;
    // Common wrappers
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.value)) return obj.value;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.Result)) return obj.Result;
    // Single object → wrap in array
    return [obj];
  }
  return [];
}

// ============================================
// Graph API Helper
// ============================================

async function getGraphToken(supabase: any, tenantRecordId: string): Promise<string | null> {
  const { data: tenant } = await supabase
    .from('m365_tenants')
    .select('tenant_id')
    .eq('id', tenantRecordId)
    .single();

  if (!tenant) return null;

  const { data: cred } = await supabase
    .from('m365_app_credentials')
    .select('azure_app_id, client_secret_encrypted, auth_type')
    .eq('tenant_record_id', tenantRecordId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!cred || !cred.client_secret_encrypted) return null;

  const encryptionKey = Deno.env.get('M365_ENCRYPTION_KEY');
  if (!encryptionKey) return null;

  let clientSecret: string;
  try {
    const keyBytes = new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const combined = Uint8Array.from(atob(cred.client_secret_encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    clientSecret = new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }

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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ConsistencyLevel: 'eventual' },
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
// Module 1: Phishing & Threats (EXO-aware)
// ============================================

function analyzePhishingThreats(
  emailActivity: any[],
  threatData: any[],
  exoAntiPhish: any[],
  exoSafeLinks: any[],
  exoSafeAttach: any[],
  exoContentFilter: any[],
): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = {
    totalBlocked: 0,
    quarantined: 0,
    topAttackedUsers: [],
    topSenderDomains: [],
  };

  // --- Graph-based threat data ---
  if (Array.isArray(threatData) && threatData.length > 0) {
    const phishingMessages = threatData.filter((t: any) =>
      (t.verdictSource || '').toLowerCase().includes('phish') ||
      (t.threatType || '').toLowerCase().includes('phish') ||
      (t.deliveryAction || '').toLowerCase().includes('blocked')
    );
    metrics.totalBlocked = phishingMessages.length;

    const userMap: Record<string, number> = {};
    for (const msg of phishingMessages) {
      const user = msg.recipientEmailAddress || msg.userPrincipalName || 'unknown';
      userMap[user] = (userMap[user] || 0) + 1;
    }
    metrics.topAttackedUsers = Object.entries(userMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([user, count]) => ({ user, count }));

    const domainMap: Record<string, number> = {};
    for (const msg of phishingMessages) {
      const sender = msg.senderAddress || msg.senderFromAddress || '';
      const domain = sender.includes('@') ? sender.split('@')[1] : sender;
      if (domain) domainMap[domain] = (domainMap[domain] || 0) + 1;
    }
    metrics.topSenderDomains = Object.entries(domainMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, count]) => ({ domain, count }));

    if (phishingMessages.length > 50) {
      insights.push({
        id: 'high_phishing_volume',
        category: 'phishing_threats',
        name: 'Alto Volume de Phishing',
        description: `${phishingMessages.length} emails de phishing detectados no período`,
        severity: phishingMessages.length > 200 ? 'critical' : 'high',
        count: phishingMessages.length,
        recommendation: 'Revise as políticas de anti-phishing e considere treinamento de conscientização.',
      });
    }
  }

  // --- EXO Anti-Phish Policy analysis ---
  for (const policy of exoAntiPhish) {
    const name = policy.Name || policy.Identity || 'Default';
    const enabled = policy.Enabled !== false && policy.EnableTargetedPhishingProtection !== false;
    const spoofEnabled = policy.EnableSpoofIntelligence !== false;
    const mailboxIntelEnabled = policy.EnableMailboxIntelligenceProtection !== false;

    if (!enabled) {
      insights.push({
        id: `antiphish_disabled_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'phishing_threats',
        name: 'Política Anti-Phishing Desabilitada',
        description: `A política "${name}" está desabilitada, expondo o tenant a ataques de phishing`,
        severity: 'critical',
        recommendation: 'Habilite a política anti-phishing imediatamente.',
        metadata: { policyName: name },
      });
    }

    if (enabled && !spoofEnabled) {
      insights.push({
        id: `antiphish_nospoof_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'phishing_threats',
        name: 'Spoof Intelligence Desabilitado',
        description: `A política "${name}" não tem Spoof Intelligence ativado`,
        severity: 'high',
        recommendation: 'Ative Spoof Intelligence para detectar emails falsificados.',
      });
    }

    if (enabled && !mailboxIntelEnabled) {
      insights.push({
        id: `antiphish_nomailboxintel_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'phishing_threats',
        name: 'Mailbox Intelligence Desabilitado',
        description: `A política "${name}" não tem Mailbox Intelligence Protection ativado`,
        severity: 'medium',
        recommendation: 'Ative Mailbox Intelligence para melhorar detecção de ameaças.',
      });
    }
  }

  // --- Safe Links ---
  if (exoSafeLinks.length === 0) {
    insights.push({
      id: 'safe_links_missing',
      category: 'phishing_threats',
      name: 'Safe Links Não Configurado',
      description: 'Nenhuma política de Safe Links encontrada. URLs maliciosas não serão verificadas.',
      severity: 'high',
      recommendation: 'Configure políticas de Safe Links no Microsoft Defender for Office 365.',
    });
  } else {
    for (const policy of exoSafeLinks) {
      const name = policy.Name || policy.Identity || 'Default';
      if (policy.EnableSafeLinksForEmail === false) {
        insights.push({
          id: `safe_links_disabled_${name.replace(/[^a-z0-9]/gi, '_')}`,
          category: 'phishing_threats',
          name: 'Safe Links Desabilitado para Email',
          description: `Safe Links desabilitado na política "${name}"`,
          severity: 'high',
          recommendation: 'Habilite Safe Links para proteção contra URLs maliciosas.',
        });
      }
    }
  }

  // --- Safe Attachments ---
  if (exoSafeAttach.length === 0) {
    insights.push({
      id: 'safe_attachments_missing',
      category: 'phishing_threats',
      name: 'Safe Attachments Não Configurado',
      description: 'Nenhuma política de Safe Attachments encontrada. Anexos maliciosos não serão verificados.',
      severity: 'high',
      recommendation: 'Configure políticas de Safe Attachments no Microsoft Defender for Office 365.',
    });
  } else {
    for (const policy of exoSafeAttach) {
      const name = policy.Name || policy.Identity || 'Default';
      const action = (policy.Action || '').toLowerCase();
      if (action === 'allow' || policy.Enable === false) {
        insights.push({
          id: `safe_attach_weak_${name.replace(/[^a-z0-9]/gi, '_')}`,
          category: 'phishing_threats',
          name: 'Safe Attachments com Ação Fraca',
          description: `Política "${name}" configurada como "${action}" — anexos maliciosos podem passar`,
          severity: 'high',
          recommendation: 'Configure a ação para "Block" ou "Replace" para proteção adequada.',
        });
      }
    }
  }

  // --- Content Filter (anti-spam) ---
  for (const policy of exoContentFilter) {
    const name = policy.Name || policy.Identity || 'Default';
    const highConfPhishAction = (policy.HighConfidencePhishAction || '').toLowerCase();
    if (highConfPhishAction === 'movetojmf' || highConfPhishAction === 'addxheader' || !highConfPhishAction) {
      insights.push({
        id: `spam_filter_weak_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'phishing_threats',
        name: 'Filtro Anti-Spam com Ação Fraca para High Confidence Phishing',
        description: `Política "${name}": phishing de alta confiança usa ação "${highConfPhishAction || 'default'}" em vez de quarentena`,
        severity: 'medium',
        recommendation: 'Configure HighConfidencePhishAction para Quarantine.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 2: Mailbox Capacity
// ============================================

function analyzeMailboxCapacity(mailboxUsage: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = {
    totalMailboxes: 0,
    above80Pct: 0,
    above90Pct: 0,
    topMailboxes: [],
  };

  if (!Array.isArray(mailboxUsage) || mailboxUsage.length === 0) return { insights, metrics };

  metrics.totalMailboxes = mailboxUsage.length;
  const critical: string[] = [];
  const warning: string[] = [];
  const topList: { user: string; usedGB: number; pct: number }[] = [];

  for (const mb of mailboxUsage) {
    const used = mb.storageUsedInBytes || mb.TotalItemSize || 0;
    const quota = mb.prohibitSendReceiveQuotaInBytes || mb.ProhibitSendReceiveQuota || mb.issueWarningQuotaInBytes || 53687091200;
    if (quota === 0) continue;
    const pct = (used / quota) * 100;
    const usedGB = Math.round((used / (1024 * 1024 * 1024)) * 100) / 100;
    const user = mb.userPrincipalName || mb.DisplayName || mb.PrimarySmtpAddress || 'unknown';

    topList.push({ user, usedGB, pct: Math.round(pct) });

    if (pct >= 90) {
      critical.push(user);
      metrics.above90Pct++;
    } else if (pct >= 80) {
      warning.push(user);
      metrics.above80Pct++;
    }
  }

  metrics.topMailboxes = topList.sort((a, b) => b.pct - a.pct).slice(0, 10);

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

function analyzeBehavioralBaseline(emailActivity: any[], baselines: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = { anomalousUsers: 0, deviations: [] };

  if (!Array.isArray(emailActivity)) return { insights, metrics };

  const baselineMap: Record<string, any> = {};
  if (Array.isArray(baselines)) {
    for (const b of baselines) baselineMap[b.user_principal_name] = b;
  }

  for (const activity of emailActivity) {
    const user = activity.userPrincipalName || '';
    const sentCount = activity.sendCount || 0;
    const baseline = baselineMap[user];
    if (!baseline) continue;

    const avgSent = parseFloat(baseline.avg_sent_daily) || 0;
    if (avgSent > 0 && sentCount > avgSent * 5) {
      const deviationPct = Math.round((sentCount / avgSent) * 100);
      metrics.anomalousUsers++;
      metrics.deviations.push({ user, metric: 'sent', current: sentCount, baseline: Math.round(avgSent), deviationPct });
      insights.push({
        id: `send_anomaly_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'behavioral_baseline',
        name: 'Envio Anômalo de Emails',
        description: `${user} enviou ${sentCount} emails (${deviationPct}% da média diária de ${Math.round(avgSent)})`,
        severity: deviationPct >= 500 ? 'critical' : deviationPct >= 200 ? 'high' : 'medium',
        affectedUsers: [user],
        count: sentCount,
        recommendation: 'Verifique se é atividade legítima ou possível comprometimento de conta.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 4: Account Compromise Detection
// ============================================

function analyzeAccountCompromise(signInLogs: any[], emailActivity: any[], inboxRules: any[]): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = {
    suspiciousLogins: 0,
    correlatedAlerts: 0,
    topRiskUsers: [],
  };

  if (!Array.isArray(signInLogs) || signInLogs.length === 0) return { insights, metrics };

  const suspiciousUsers = new Set<string>();
  const userLocations: Record<string, Set<string>> = {};

  for (const log of signInLogs) {
    const user = log.userPrincipalName || '';
    const country = log.location?.countryOrRegion || '';
    const riskLevel = (log.riskLevelDuringSignIn || '').toLowerCase();

    if (!userLocations[user]) userLocations[user] = new Set();
    if (country) userLocations[user].add(country);

    if (riskLevel === 'high' || riskLevel === 'medium') {
      suspiciousUsers.add(user);
      metrics.suspiciousLogins++;
    }
  }

  const activityMap: Record<string, number> = {};
  if (Array.isArray(emailActivity)) {
    for (const a of emailActivity) activityMap[a.userPrincipalName || ''] = a.sendCount || 0;
  }

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
      metrics.correlatedAlerts++;
      const reasons: string[] = [];
      if (highSend) reasons.push(`envio massivo (${activityMap[user]} emails)`);
      if (hasNewRule) reasons.push('criação de regra de inbox');
      if (multiCountry) reasons.push(`login de ${userLocations[user]?.size} países`);

      metrics.topRiskUsers.push({ user, reasons });
      insights.push({
        id: `compromise_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'account_compromise',
        name: 'Alta Probabilidade de Conta Comprometida',
        description: `${user}: login suspeito correlacionado com ${reasons.join(', ')}`,
        severity: 'critical',
        affectedUsers: [user],
        recommendation: 'Bloqueie a conta imediatamente, revogue sessões ativas e investigue.',
      });
    }
  }

  return { insights, metrics };
}

// ============================================
// Module 5: Suspicious Rules (EXO-aware)
// ============================================

function analyzeSuspiciousRules(
  auditLogs: any[],
  exoForwarding: any[],
  exoTransportRules: any[],
): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = {
    externalForwards: 0,
    autoDelete: 0,
    suspiciousRules: [] as { user: string; ruleName: string; action: string; destination?: string }[],
  };

  // --- EXO Mailbox Forwarding ---
  for (const fwd of exoForwarding) {
    const user = fwd.PrimarySmtpAddress || fwd.DisplayName || fwd.Identity || 'unknown';
    const forwardAddr = fwd.ForwardingSmtpAddress || fwd.ForwardingAddress || '';
    const deliverToMailbox = fwd.DeliverToMailboxAndForward;

    if (forwardAddr) {
      metrics.externalForwards++;
      const entry = { user, ruleName: 'Mailbox Forwarding', action: 'forward', destination: forwardAddr };
      metrics.suspiciousRules.push(entry);
      insights.push({
        id: `fwd_${user.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'suspicious_rules',
        name: 'Encaminhamento de Mailbox Ativo',
        description: `${user} tem encaminhamento para ${forwardAddr}${deliverToMailbox ? ' (com cópia na caixa)' : ' (sem cópia na caixa)'}`,
        severity: forwardAddr.includes('external') || !forwardAddr.includes(user.split('@')[1] || '') ? 'critical' : 'high',
        affectedUsers: [user],
        metadata: { forwardAddr, deliverToMailbox },
        recommendation: 'Verifique se o encaminhamento é autorizado. Encaminhamentos não autorizados podem indicar comprometimento.',
      });
    }
  }

  // --- EXO Transport Rules ---
  for (const rule of exoTransportRules) {
    const name = rule.Name || rule.Identity || 'Unknown';
    const state = (rule.State || '').toLowerCase();
    if (state === 'disabled') continue;

    const redirectTo = rule.RedirectMessageTo || '';
    const copyTo = rule.CopyTo || '';
    const blindCopyTo = rule.BlindCopyTo || '';
    const deleteMsg = rule.DeleteMessage === true;

    if (redirectTo || copyTo || blindCopyTo) {
      const dest = redirectTo || copyTo || blindCopyTo;
      metrics.externalForwards++;
      metrics.suspiciousRules.push({ user: 'TransportRule', ruleName: name, action: 'redirect', destination: String(dest) });
      insights.push({
        id: `transport_redirect_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'suspicious_rules',
        name: 'Transport Rule com Redirecionamento',
        description: `Regra de transporte "${name}" redireciona emails para ${dest}`,
        severity: 'high',
        recommendation: 'Verifique se esta regra de transporte é necessária e autorizada.',
        metadata: { redirectTo, copyTo, blindCopyTo },
      });
    }

    if (deleteMsg) {
      metrics.autoDelete++;
      metrics.suspiciousRules.push({ user: 'TransportRule', ruleName: name, action: 'delete' });
      insights.push({
        id: `transport_delete_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'suspicious_rules',
        name: 'Transport Rule com Exclusão',
        description: `Regra de transporte "${name}" deleta emails automaticamente`,
        severity: 'high',
        recommendation: 'Regras de exclusão automática podem ocultar atividade maliciosa. Investigue.',
      });
    }
  }

  // --- Audit log-based rules (Graph API data) ---
  if (Array.isArray(auditLogs)) {
    for (const log of auditLogs) {
      const activity = (log.activityDisplayName || log.operationName || '').toLowerCase();
      const target = log.targetResources?.[0]?.displayName || '';
      const user = log.initiatedBy?.user?.userPrincipalName || log.userId || '';

      if (activity.includes('inbox rule') || activity.includes('new-inboxrule') || activity.includes('set-inboxrule')) {
        const modifiedProps = log.targetResources?.[0]?.modifiedProperties || [];
        for (const prop of modifiedProps) {
          const propName = (prop.displayName || '').toLowerCase();
          const val = (prop.newValue || '').toLowerCase();
          if (propName.includes('forwardto') || propName.includes('redirectto')) {
            metrics.externalForwards++;
            metrics.suspiciousRules.push({ user, ruleName: target, action: 'forward', destination: prop.newValue || '' });
            insights.push({
              id: `audit_fwd_${user.replace(/[^a-z0-9]/gi, '_')}_${target.replace(/[^a-z0-9]/gi, '_')}`,
              category: 'suspicious_rules',
              name: 'Regra de Redirecionamento via Audit',
              description: `${user} criou regra "${target}" com forward para ${prop.newValue}`,
              severity: 'critical',
              affectedUsers: [user],
              recommendation: 'Verifique se o redirecionamento é autorizado.',
            });
          }
          if (propName.includes('deletemessage') && val === 'true') {
            metrics.autoDelete++;
            metrics.suspiciousRules.push({ user, ruleName: target, action: 'delete' });
            insights.push({
              id: `audit_delete_${user.replace(/[^a-z0-9]/gi, '_')}_${target.replace(/[^a-z0-9]/gi, '_')}`,
              category: 'suspicious_rules',
              name: 'Regra de Exclusão Automática via Audit',
              description: `${user} criou regra "${target}" que deleta emails`,
              severity: 'high',
              affectedUsers: [user],
              recommendation: 'Investigue a finalidade dessa regra.',
            });
          }
        }
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
  const metrics: Record<string, any> = {
    highVolumeExternal: 0,
    topExternalDomains: [],
  };

  if (!Array.isArray(emailActivity)) return { insights, metrics };

  for (const activity of emailActivity) {
    const user = activity.userPrincipalName || '';
    const externalSent = activity.sendCount || 0;
    if (externalSent > 100) {
      metrics.highVolumeExternal++;
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
// Module 7: Operational Risks (EXO-aware)
// ============================================

function analyzeOperationalRisks(
  signInLogs: any[],
  auditLogs: any[],
  exoOrgConfig: any[],
  exoRemoteDomains: any[],
  exoMalwareFilter: any[],
): { insights: M365AnalyzerInsight[]; metrics: Record<string, any> } {
  const insights: M365AnalyzerInsight[] = [];
  const metrics: Record<string, any> = {
    smtpAuthEnabled: 0,
    legacyProtocols: 0,
    inactiveWithActivity: 0,
    fullAccessGrants: 0,
  };

  // --- EXO Org Config: SMTP Auth ---
  for (const cfg of exoOrgConfig) {
    const smtpAuth = cfg.SmtpClientAuthenticationDisabled;
    if (smtpAuth === false) {
      // SMTP auth is ENABLED org-wide (bad)
      metrics.smtpAuthEnabled = 1;
      insights.push({
        id: 'smtp_auth_enabled',
        category: 'operational_risks',
        name: 'SMTP Auth Habilitado no Nível Organizacional',
        description: 'SmtpClientAuthenticationDisabled=false — SMTP Auth está habilitado para toda a organização',
        severity: 'high',
        recommendation: 'Desabilite SMTP Auth org-wide e habilite apenas para mailboxes que necessitam.',
      });
    }

    // Check OAuth
    const oauthEnabled = cfg.OAuth2ClientProfileEnabled;
    if (oauthEnabled === false) {
      insights.push({
        id: 'oauth_disabled',
        category: 'operational_risks',
        name: 'OAuth2 Desabilitado',
        description: 'OAuth2ClientProfileEnabled=false — Autenticação moderna está desabilitada',
        severity: 'critical',
        recommendation: 'Habilite OAuth2 para autenticação moderna.',
      });
    }
  }

  // --- Remote Domains: auto-forward ---
  for (const domain of exoRemoteDomains) {
    const name = domain.DomainName || domain.Name || 'Default';
    if (domain.AutoForwardEnabled === true) {
      insights.push({
        id: `remote_domain_fwd_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'operational_risks',
        name: 'Auto-Forward Habilitado em Remote Domain',
        description: `Remote domain "${name}" permite auto-forward de emails`,
        severity: name === '*' || name === 'Default' ? 'critical' : 'high',
        recommendation: 'Desabilite auto-forward em remote domains, especialmente no domínio padrão (*)',
      });
    }
  }

  // --- Malware Filter ---
  for (const policy of exoMalwareFilter) {
    const name = policy.Name || policy.Identity || 'Default';
    if (policy.EnableFileFilter === false) {
      insights.push({
        id: `malware_nofilefilter_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'operational_risks',
        name: 'Filtro de Anexos Desabilitado',
        description: `Política de malware "${name}" tem FileFilter desabilitado`,
        severity: 'high',
        recommendation: 'Habilite o filtro de tipos de arquivo comuns (exe, scr, etc.).',
      });
    }
    if (policy.ZapEnabled === false) {
      insights.push({
        id: `malware_nozap_${name.replace(/[^a-z0-9]/gi, '_')}`,
        category: 'operational_risks',
        name: 'ZAP Desabilitado para Malware',
        description: `Política de malware "${name}" tem Zero-hour Auto Purge desabilitado`,
        severity: 'medium',
        recommendation: 'Habilite ZAP para remover automaticamente mensagens maliciosas já entregues.',
      });
    }
  }

  // --- Legacy auth from sign-in logs ---
  if (Array.isArray(signInLogs)) {
    const legacyUsers = new Set<string>();
    for (const log of signInLogs) {
      const clientApp = (log.clientAppUsed || '').toLowerCase();
      if (clientApp.includes('smtp') || clientApp.includes('imap') || clientApp.includes('pop3') || clientApp.includes('other')) {
        legacyUsers.add(log.userPrincipalName || '');
      }
    }
    if (legacyUsers.size > 0) {
      metrics.legacyProtocols = legacyUsers.size;
      insights.push({
        id: 'legacy_auth_detected',
        category: 'operational_risks',
        name: 'Protocolo Legado em Uso',
        description: `${legacyUsers.size} usuário(s) utilizando SMTP/IMAP/POP3`,
        severity: 'medium',
        affectedUsers: [...legacyUsers].slice(0, 20),
        count: legacyUsers.size,
        recommendation: 'Desabilite protocolos legados e migre para autenticação moderna.',
      });
    }
  }

  // --- FullAccess grants from audit logs ---
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
          recommendation: 'Verifique se a concessão de acesso completo é autorizada.',
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

    await supabase
      .from('m365_analyzer_snapshots')
      .update({ status: 'processing' })
      .eq('id', snapshot_id);

    // Data variables
    let emailActivity: any[] = [];
    let mailboxUsage: any[] = [];
    let signInLogs: any[] = [];
    let auditLogs: any[] = [];
    let threatData: any[] = [];
    let inboxRules: any[] = [];

    // EXO-specific data from agent
    let exoForwarding: any[] = [];
    let exoTransportRules: any[] = [];
    let exoOrgConfig: any[] = [];
    let exoSafeLinks: any[] = [];
    let exoSafeAttach: any[] = [];
    let exoAntiPhish: any[] = [];
    let exoContentFilter: any[] = [];
    let exoMalwareFilter: any[] = [];
    let exoRemoteDomains: any[] = [];

    let dataSource = 'none';
    let stepsReceived: string[] = [];

    // ── Strategy: try raw_data from agent first ──
    if (raw_data && typeof raw_data === 'object') {
      dataSource = 'agent';

      const keys = Object.keys(raw_data);
      stepsReceived = keys;
      console.log(`[m365-analyzer] raw_data keys (${keys.length}): ${keys.join(', ')}`);

      // Normalize each step
      const get = (key: string) => normalizeStepData(raw_data[key]);

      // Graph API-style data (if agent collected via edge_function steps)
      signInLogs = get('signin_logs').concat(get('failed_signins'));
      auditLogs = get('audit_logs');
      emailActivity = get('email_activity');
      mailboxUsage = get('mailbox_usage');
      threatData = get('threat_data');
      inboxRules = get('inbox_rules');

      // EXO PowerShell data — the PRIMARY data source for CBA tenants
      exoForwarding = get('exo_mailbox_forwarding');
      exoTransportRules = get('exo_transport_rules');
      exoOrgConfig = get('exo_org_config');
      exoSafeLinks = get('exo_safe_links_policy');
      exoSafeAttach = get('exo_safe_attachment_policy');
      exoAntiPhish = get('exo_anti_phish_policy');
      exoContentFilter = get('exo_hosted_content_filter');
      exoMalwareFilter = get('exo_malware_filter_policy');
      exoRemoteDomains = get('exo_remote_domains');

      // Also try alternate key names (some agents use slightly different IDs)
      if (exoForwarding.length === 0) exoForwarding = get('exo_forwarding');
      if (exoAntiPhish.length === 0) exoAntiPhish = get('exo_antiphish_policy');
      if (exoContentFilter.length === 0) exoContentFilter = get('exo_content_filter');

      // Build inboxRules from forwarding data for compromise module
      if (inboxRules.length === 0 && exoForwarding.length > 0) {
        inboxRules = exoForwarding
          .filter((f: any) => f.ForwardingSmtpAddress || f.ForwardingAddress)
          .map((f: any) => ({
            userPrincipalName: f.PrimarySmtpAddress || f.DisplayName || '',
            ruleName: 'Mailbox Forwarding',
            forwardTo: f.ForwardingSmtpAddress || f.ForwardingAddress || '',
          }));
      }

      const exoTotal = exoForwarding.length + exoTransportRules.length + exoOrgConfig.length +
        exoSafeLinks.length + exoSafeAttach.length + exoAntiPhish.length +
        exoContentFilter.length + exoMalwareFilter.length + exoRemoteDomains.length;
      const graphTotal = signInLogs.length + auditLogs.length + emailActivity.length + mailboxUsage.length + threatData.length;

      console.log(`[m365-analyzer] Agent data: EXO items=${exoTotal}, Graph items=${graphTotal}`);
    }

    // ── Graph API fallback: only if NO useful data at all ──
    const hasAgentData = dataSource === 'agent' && (
      exoForwarding.length > 0 || exoTransportRules.length > 0 || exoOrgConfig.length > 0 ||
      exoSafeLinks.length > 0 || exoSafeAttach.length > 0 || exoAntiPhish.length > 0 ||
      exoContentFilter.length > 0 || exoMalwareFilter.length > 0 || exoRemoteDomains.length > 0 ||
      signInLogs.length > 0 || auditLogs.length > 0 || emailActivity.length > 0
    );

    if (!hasAgentData) {
      const token = await getGraphToken(supabase, snapshot.tenant_record_id);
      if (token) {
        console.log('[m365-analyzer] Got Graph API token, collecting data...');
        dataSource = dataSource === 'agent' ? 'hybrid' : 'graph_api';

        const periodFilter = snapshot.period_start ? `&$filter=createdDateTime ge ${snapshot.period_start}` : '';

        const [emailData, mailboxData, signInData, auditData, threatStatus] = await Promise.all([
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getEmailActivityUserDetail(period=\'D1\')'),
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getMailboxUsageDetail(period=\'D1\')'),
          graphGet(token, `https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=500${periodFilter}`),
          graphGet(token, `https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$top=500${periodFilter}`),
          graphGet(token, 'https://graph.microsoft.com/v1.0/reports/getEmailActivityUserDetail(period=\'D1\')'),
        ]);

        if (emailActivity.length === 0) emailActivity = Array.isArray(emailData?.value) ? emailData.value : [];
        if (mailboxUsage.length === 0) mailboxUsage = Array.isArray(mailboxData?.value) ? mailboxData.value : [];
        if (signInLogs.length === 0) signInLogs = Array.isArray(signInData?.value) ? signInData.value : [];
        if (auditLogs.length === 0) auditLogs = Array.isArray(auditData?.value) ? auditData.value : [];
        if (threatData.length === 0) threatData = Array.isArray(threatStatus?.value) ? threatStatus.value : [];
      } else if (dataSource === 'none') {
        console.error('[m365-analyzer] No data source available');
        await supabase
          .from('m365_analyzer_snapshots')
          .update({ status: 'failed', insights: [], metrics: { error: 'No data source: Graph API failed and no agent data' } })
          .eq('id', snapshot_id);
        return new Response(
          JSON.stringify({ success: false, error: 'No data source available' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('[m365-analyzer] Graph API unavailable, proceeding with agent data only');
      }
    }

    console.log(`[m365-analyzer] Data ready (source=${dataSource}): emails=${emailActivity.length}, mailboxes=${mailboxUsage.length}, signIns=${signInLogs.length}, audits=${auditLogs.length}, exoFwd=${exoForwarding.length}, exoTransport=${exoTransportRules.length}, exoAntiPhish=${exoAntiPhish.length}, exoOrgCfg=${exoOrgConfig.length}`);

    // Fetch existing baselines
    const { data: baselines } = await supabase
      .from('m365_user_baselines')
      .select('*')
      .eq('tenant_record_id', snapshot.tenant_record_id);

    // ── Run analysis modules ──
    const allInsights: M365AnalyzerInsight[] = [];

    const phishing = analyzePhishingThreats(emailActivity, threatData, exoAntiPhish, exoSafeLinks, exoSafeAttach, exoContentFilter);
    allInsights.push(...phishing.insights);

    const mailbox = analyzeMailboxCapacity(mailboxUsage);
    allInsights.push(...mailbox.insights);

    const behavioral = analyzeBehavioralBaseline(emailActivity, baselines || []);
    allInsights.push(...behavioral.insights);

    const compromise = analyzeAccountCompromise(signInLogs, emailActivity, inboxRules);
    allInsights.push(...compromise.insights);

    const rules = analyzeSuspiciousRules(auditLogs, exoForwarding, exoTransportRules);
    allInsights.push(...rules.insights);

    const exfiltration = analyzeExfiltration(emailActivity);
    allInsights.push(...exfiltration.insights);

    const operational = analyzeOperationalRisks(signInLogs, auditLogs, exoOrgConfig, exoRemoteDomains, exoMalwareFilter);
    allInsights.push(...operational.insights);

    // Build metrics in the exact shape expected by the frontend
    const allMetrics = {
      phishing: {
        totalBlocked: phishing.metrics.totalBlocked || 0,
        quarantined: phishing.metrics.quarantined || 0,
        topAttackedUsers: phishing.metrics.topAttackedUsers || [],
        topSenderDomains: phishing.metrics.topSenderDomains || [],
      },
      mailbox: {
        totalMailboxes: mailbox.metrics.totalMailboxes || 0,
        above80Pct: mailbox.metrics.above80Pct || 0,
        above90Pct: mailbox.metrics.above90Pct || 0,
        topMailboxes: mailbox.metrics.topMailboxes || [],
      },
      behavioral: {
        anomalousUsers: behavioral.metrics.anomalousUsers || 0,
        deviations: behavioral.metrics.deviations || [],
      },
      compromise: {
        suspiciousLogins: compromise.metrics.suspiciousLogins || 0,
        correlatedAlerts: compromise.metrics.correlatedAlerts || 0,
        topRiskUsers: compromise.metrics.topRiskUsers || [],
      },
      rules: {
        externalForwards: rules.metrics.externalForwards || 0,
        autoDelete: rules.metrics.autoDelete || 0,
        suspiciousRules: rules.metrics.suspiciousRules || [],
      },
      exfiltration: {
        highVolumeExternal: exfiltration.metrics.highVolumeExternal || 0,
        topExternalDomains: exfiltration.metrics.topExternalDomains || [],
      },
      operational: {
        smtpAuthEnabled: operational.metrics.smtpAuthEnabled || 0,
        legacyProtocols: operational.metrics.legacyProtocols || 0,
        inactiveWithActivity: operational.metrics.inactiveWithActivity || 0,
        fullAccessGrants: operational.metrics.fullAccessGrants || 0,
      },
      dataSource,
      normalizationVersion: 2,
      stepsReceived,
    };

    const { score, summary } = calculateScore(allInsights);

    console.log(`[m365-analyzer] Result: score=${score}, insights=${allInsights.length}, summary=${JSON.stringify(summary)}`);

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

    // Update baselines
    if (emailActivity.length > 0 && (!baselines || baselines.length === 0)) {
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
      JSON.stringify({ success: true, snapshot_id, score, summary, insights_count: allInsights.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[m365-analyzer] Error:', error);
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
      }
    } catch { /* ignore cleanup error */ }

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
