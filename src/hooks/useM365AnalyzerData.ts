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
};

function parseSnapshot(row: Record<string, unknown>): M365AnalyzerSnapshot {
  const rawSummary = (row.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }) as unknown as M365AnalyzerSummary;
  const insights = (Array.isArray(row.insights) ? row.insights : []) as unknown as M365AnalyzerInsight[];
  const rawMetrics = (row.metrics ?? {}) as Record<string, unknown>;

  const metrics: M365AnalyzerMetrics = {
    phishing: (rawMetrics.phishing as M365AnalyzerMetrics['phishing']) ?? defaultMetrics.phishing,
    mailbox: (rawMetrics.mailbox as M365AnalyzerMetrics['mailbox']) ?? defaultMetrics.mailbox,
    behavioral: (rawMetrics.behavioral as M365AnalyzerMetrics['behavioral']) ?? defaultMetrics.behavioral,
    compromise: (rawMetrics.compromise as M365AnalyzerMetrics['compromise']) ?? defaultMetrics.compromise,
    rules: (rawMetrics.rules as M365AnalyzerMetrics['rules']) ?? defaultMetrics.rules,
    exfiltration: (rawMetrics.exfiltration as M365AnalyzerMetrics['exfiltration']) ?? defaultMetrics.exfiltration,
    operational: (rawMetrics.operational as M365AnalyzerMetrics['operational']) ?? defaultMetrics.operational,
  };

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
    const key = `${ins.category}::${ins.name}`;
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

  // Use latest snapshot's metrics (most current state)
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
        .select('*')
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

      // Reconcile: if snapshot is pending/processing but agent_task is terminal, treat as orphan
      if (snap.agent_task_id && (snap.status === 'pending' || snap.status === 'processing')) {
        const { data: taskData } = await supabase
          .from('agent_tasks')
          .select('status')
          .eq('id', snap.agent_task_id)
          .maybeSingle();

        const taskStatus = (taskData as any)?.status;
        if (taskStatus && ['completed', 'failed', 'timeout', 'cancelled'].includes(taskStatus)) {
          return { status: 'orphan' as string, elapsed: null as number | null, snapshotId: snap.id as string, reconciled: true };
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
