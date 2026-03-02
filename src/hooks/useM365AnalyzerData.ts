import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  M365AnalyzerSnapshot,
  M365AnalyzerInsight,
  M365AnalyzerSummary,
  M365AnalyzerMetrics,
} from '@/types/m365AnalyzerInsights';

const defaultMetrics: M365AnalyzerMetrics = {
  phishing: { totalBlocked: 0, quarantined: 0, topAttackedUsers: [], topSenderDomains: [] },
  mailbox: { totalMailboxes: 0, above80Pct: 0, above90Pct: 0, topMailboxes: [] },
  behavioral: { anomalousUsers: 0, deviations: [] },
  compromise: { suspiciousLogins: 0, correlatedAlerts: 0, topRiskUsers: [] },
  rules: { externalForwards: 0, autoDelete: 0, suspiciousRules: [] },
  exfiltration: { highVolumeExternal: 0, topExternalDomains: [] },
  operational: { smtpAuthEnabled: 0, legacyProtocols: 0, inactiveWithActivity: 0, fullAccessGrants: 0 },
  securityRisk: { highRiskSignIns: 0, mfaFailures: 0, impossibleTravel: 0, blockedAccounts: 0, riskyUsers: 0 },
  identity: { newUsers: 0, disabledUsers: 0, noMfaUsers: 0, noConditionalAccess: 0, serviceAccountInteractive: 0, recentAppRegistrations: 0 },
  conditionalAccess: { disabledPolicies: 0, reportOnlyPolicies: 0, excludedUsers: 0, recentlyCreated: 0 },
  exchangeHealth: { serviceIncidents: 0, messageTraceFailures: 0, sharedMailboxesNoOwner: 0, connectorFailures: 0 },
  audit: { mailboxAuditAlerts: 0, adminAuditChanges: 0, newDelegations: 0, activeEdiscovery: 0 },
};

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

function safeNum(val: unknown): number {
  return typeof val === 'number' ? val : 0;
}

function parseMetrics(raw: unknown): M365AnalyzerMetrics {
  if (!raw || typeof raw !== 'object') return { ...defaultMetrics };
  const m = raw as Record<string, any>;

  const ph = m.phishing ?? {};
  const mb = m.mailbox ?? {};
  const bh = m.behavioral ?? {};
  const co = m.compromise ?? {};
  const ru = m.rules ?? {};
  const ex = m.exfiltration ?? {};
  const op = m.operational ?? {};
  const sr = m.securityRisk ?? m.security_risk ?? {};
  const id = m.identity ?? m.identity_access ?? {};
  const ca = m.conditionalAccess ?? m.conditional_access ?? {};
  const eh = m.exchangeHealth ?? m.exchange_health ?? {};
  const au = m.audit ?? m.audit_compliance ?? {};

  return {
    phishing: {
      totalBlocked: safeNum(ph.totalBlocked ?? ph.totalPhishing),
      quarantined: safeNum(ph.quarantined),
      topAttackedUsers: safeArray(ph.topAttackedUsers),
      topSenderDomains: safeArray(ph.topSenderDomains),
    },
    mailbox: {
      totalMailboxes: safeNum(mb.totalMailboxes),
      above80Pct: safeNum(mb.above80Pct ?? mb.above80),
      above90Pct: safeNum(mb.above90Pct ?? mb.above90),
      topMailboxes: safeArray(mb.topMailboxes),
    },
    behavioral: {
      anomalousUsers: safeNum(bh.anomalousUsers),
      deviations: safeArray(bh.deviations),
    },
    compromise: {
      suspiciousLogins: safeNum(co.suspiciousLogins ?? co.suspiciousSignIns),
      correlatedAlerts: safeNum(co.correlatedAlerts ?? co.potentiallyCompromised),
      topRiskUsers: safeArray(co.topRiskUsers),
    },
    rules: {
      externalForwards: safeNum(ru.externalForwards ?? ru.suspiciousRules),
      autoDelete: safeNum(ru.autoDelete),
      suspiciousRules: safeArray(ru.suspiciousRules),
    },
    exfiltration: {
      highVolumeExternal: safeNum(ex.highVolumeExternal ?? ex.exfiltrationRisk),
      topExternalDomains: safeArray(ex.topExternalDomains),
    },
    operational: {
      smtpAuthEnabled: safeNum(op.smtpAuthEnabled),
      legacyProtocols: safeNum(op.legacyProtocols ?? op.legacyAuthUsers),
      inactiveWithActivity: safeNum(op.inactiveWithActivity),
      fullAccessGrants: safeNum(op.fullAccessGrants),
    },
    securityRisk: {
      highRiskSignIns: safeNum(sr.highRiskSignIns),
      mfaFailures: safeNum(sr.mfaFailures),
      impossibleTravel: safeNum(sr.impossibleTravel),
      blockedAccounts: safeNum(sr.blockedAccounts),
      riskyUsers: safeNum(sr.riskyUsers),
    },
    identity: {
      newUsers: safeNum(id.newUsers),
      disabledUsers: safeNum(id.disabledUsers),
      noMfaUsers: safeNum(id.noMfaUsers),
      noConditionalAccess: safeNum(id.noConditionalAccess),
      serviceAccountInteractive: safeNum(id.serviceAccountInteractive),
      recentAppRegistrations: safeNum(id.recentAppRegistrations),
    },
    conditionalAccess: {
      disabledPolicies: safeNum(ca.disabledPolicies),
      reportOnlyPolicies: safeNum(ca.reportOnlyPolicies),
      excludedUsers: safeNum(ca.excludedUsers),
      recentlyCreated: safeNum(ca.recentlyCreated),
    },
    exchangeHealth: {
      serviceIncidents: safeNum(eh.serviceIncidents),
      messageTraceFailures: safeNum(eh.messageTraceFailures),
      sharedMailboxesNoOwner: safeNum(eh.sharedMailboxesNoOwner),
      connectorFailures: safeNum(eh.connectorFailures),
    },
    audit: {
      mailboxAuditAlerts: safeNum(au.mailboxAuditAlerts),
      adminAuditChanges: safeNum(au.adminAuditChanges),
      newDelegations: safeNum(au.newDelegations),
      activeEdiscovery: safeNum(au.activeEdiscovery),
    },
  };
}

function parseSnapshot(row: Record<string, unknown>): M365AnalyzerSnapshot {
  const rawSummary = (row.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }) as unknown as M365AnalyzerSummary;
  const insights = (Array.isArray(row.insights) ? row.insights : []) as unknown as M365AnalyzerInsight[];
  const metrics = parseMetrics(row.metrics);

  return {
    id: row.id as string,
    tenant_record_id: row.tenant_record_id as string,
    client_id: row.client_id as string,
    agent_task_id: (row.agent_task_id as string) ?? undefined,
    status: (row.status as M365AnalyzerSnapshot['status']) ?? 'pending',
    period_start: (row.period_start as string) ?? undefined,
    period_end: (row.period_end as string) ?? undefined,
    score: (row.score as number) ?? undefined,
    summary: rawSummary,
    insights,
    metrics,
    created_at: row.created_at as string,
  };
}

function deduplicateInsights(insights: M365AnalyzerInsight[]): M365AnalyzerInsight[] {
  const seen = new Set<string>();
  return insights.filter(ins => {
    const key = ins.id ? ins.id : `${ins.category}::${ins.name}::${ins.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function aggregateSnapshots(snapshots: M365AnalyzerSnapshot[]): M365AnalyzerSnapshot & { snapshotCount: number } | null {
  if (!snapshots.length) return null;

  const latest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];

  const summary: M365AnalyzerSummary = snapshots.reduce(
    (acc, s) => ({
      critical: acc.critical + (s.summary?.critical ?? 0),
      high: acc.high + (s.summary?.high ?? 0),
      medium: acc.medium + (s.summary?.medium ?? 0),
      low: acc.low + (s.summary?.low ?? 0),
      info: acc.info + (s.summary?.info ?? 0),
    }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const metrics = latest.metrics;

  return {
    ...latest,
    period_start: oldest.period_start ?? latest.period_start,
    period_end: latest.period_end,
    summary,
    insights: deduplicateInsights(snapshots.flatMap(s => s.insights ?? [])),
    metrics,
    snapshotCount: snapshots.length,
  };
}

export function useLatestM365AnalyzerSnapshot(tenantRecordId?: string) {
  return useQuery({
    queryKey: ['m365-analyzer-latest', tenantRecordId],
    queryFn: async () => {
      if (!tenantRecordId) return null;

      const { data, error } = await supabase
        .from('m365_analyzer_snapshots' as any)
        .select('id, tenant_record_id, client_id, agent_task_id, status, period_start, period_end, score, summary, metrics, created_at')
        .eq('tenant_record_id', tenantRecordId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(24) as any;

      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) return null;

      const snapshots = rows.map((r) => parseSnapshot(r as Record<string, unknown>));
      return aggregateSnapshots(snapshots);
    },
    enabled: !!tenantRecordId,
    staleTime: 1000 * 30,
  });
}

export function useM365AnalyzerProgress(tenantRecordId?: string) {
  return useQuery({
    queryKey: ['m365-analyzer-progress', tenantRecordId],
    queryFn: async () => {
      if (!tenantRecordId) return null;
      const { data } = await supabase
        .from('m365_analyzer_snapshots' as any)
        .select('id, status, created_at, agent_task_id')
        .eq('tenant_record_id', tenantRecordId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any;

      if (!data) return null;
      const snap = data as any;
      if (snap.status === 'completed' || snap.status === 'failed' || snap.status === 'cancelled') {
        return { status: snap.status as string, elapsed: null as number | null };
      }

      if (snap.agent_task_id && (snap.status === 'pending' || snap.status === 'processing')) {
        const { data: taskData } = await supabase
          .from('agent_tasks')
          .select('status')
          .eq('id', snap.agent_task_id)
          .maybeSingle();

        const taskStatus = (taskData as any)?.status;
        if (taskStatus && ['completed', 'failed', 'timeout', 'cancelled'].includes(taskStatus)) {
          await supabase
            .from('m365_analyzer_snapshots' as any)
            .update({ status: 'failed', metrics: { recovered_reason: `orphan_task_${taskStatus}` } })
            .eq('id', snap.id);
          return { status: 'failed' as string, elapsed: null as number | null, snapshotId: snap.id as string, wasOrphan: true };
        }
      }

      const elapsed = Math.floor((Date.now() - new Date(snap.created_at).getTime()) / 1000);
      return { status: snap.status as string, elapsed, snapshotId: snap.id as string };
    },
    enabled: !!tenantRecordId,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
