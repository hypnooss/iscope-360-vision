import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyzerSnapshot, AnalyzerInsight, AnalyzerMetrics, AnalyzerSummary } from '@/types/analyzerInsights';
import type { Json } from '@/integrations/supabase/types';

function parseSnapshot(row: Record<string, unknown>): AnalyzerSnapshot {
  const rawSummary = (row.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }) as unknown as AnalyzerSummary;
  const insights = (Array.isArray(row.insights) ? row.insights : []) as unknown as AnalyzerInsight[];
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;

  return {
    id: row.id as string,
    firewall_id: row.firewall_id as string,
    client_id: row.client_id as string,
    agent_task_id: (row.agent_task_id as string) ?? undefined,
    status: (row.status as AnalyzerSnapshot['status']) ?? 'pending',
    period_start: (row.period_start as string) ?? undefined,
    period_end: (row.period_end as string) ?? undefined,
    score: (row.score as number) ?? undefined,
    summary: rawSummary,
    insights,
    metrics: {
      topBlockedIPs: (metrics.topBlockedIPs as AnalyzerMetrics['topBlockedIPs']) ?? [],
      topCountries: (metrics.topCountries as AnalyzerMetrics['topCountries']) ?? [],
      vpnFailures: (metrics.vpnFailures as number) ?? 0,
      firewallAuthFailures: (metrics.firewallAuthFailures as number) ?? 0,
      firewallAuthSuccesses: (metrics.firewallAuthSuccesses as number) ?? 0,
      vpnSuccesses: (metrics.vpnSuccesses as number) ?? 0,
      topAuthIPs: (metrics.topAuthIPs as AnalyzerMetrics['topAuthIPs']) ?? [],
      topAuthCountries: (metrics.topAuthCountries as AnalyzerMetrics['topAuthCountries']) ?? [],
      topAuthIPsSuccess: (metrics.topAuthIPsSuccess as AnalyzerMetrics['topAuthIPsSuccess']) ?? [],
      topAuthIPsFailed: (metrics.topAuthIPsFailed as AnalyzerMetrics['topAuthIPsFailed']) ?? [],
      topAuthCountriesSuccess: (metrics.topAuthCountriesSuccess as AnalyzerMetrics['topAuthCountriesSuccess']) ?? [],
      topAuthCountriesFailed: (metrics.topAuthCountriesFailed as AnalyzerMetrics['topAuthCountriesFailed']) ?? [],
      // Separated FW auth
      topFwAuthIPsFailed: (metrics.topFwAuthIPsFailed as AnalyzerMetrics['topFwAuthIPsFailed']) ?? [],
      topFwAuthIPsSuccess: (metrics.topFwAuthIPsSuccess as AnalyzerMetrics['topFwAuthIPsSuccess']) ?? [],
      topFwAuthCountriesFailed: (metrics.topFwAuthCountriesFailed as AnalyzerMetrics['topFwAuthCountriesFailed']) ?? [],
      topFwAuthCountriesSuccess: (metrics.topFwAuthCountriesSuccess as AnalyzerMetrics['topFwAuthCountriesSuccess']) ?? [],
      // Separated VPN auth
      topVpnAuthIPsFailed: (metrics.topVpnAuthIPsFailed as AnalyzerMetrics['topVpnAuthIPsFailed']) ?? [],
      topVpnAuthIPsSuccess: (metrics.topVpnAuthIPsSuccess as AnalyzerMetrics['topVpnAuthIPsSuccess']) ?? [],
      topVpnAuthCountriesFailed: (metrics.topVpnAuthCountriesFailed as AnalyzerMetrics['topVpnAuthCountriesFailed']) ?? [],
      topVpnAuthCountriesSuccess: (metrics.topVpnAuthCountriesSuccess as AnalyzerMetrics['topVpnAuthCountriesSuccess']) ?? [],
      // Outbound
      topOutboundIPs: (metrics.topOutboundIPs as AnalyzerMetrics['topOutboundIPs']) ?? [],
      topOutboundCountries: (metrics.topOutboundCountries as AnalyzerMetrics['topOutboundCountries']) ?? [],
      outboundConnections: (metrics.outboundConnections as number) ?? 0,
      ipsEvents: (metrics.ipsEvents as number) ?? 0,
      configChanges: (metrics.configChanges as number) ?? 0,
      configChangeDetails: (metrics.configChangeDetails as AnalyzerMetrics['configChangeDetails']) ?? [],
      totalDenied: (metrics.totalDenied as number) ?? 0,
      totalEvents: (metrics.totalEvents as number) ?? 0,
      topWebFilterCategories: (metrics.topWebFilterCategories as AnalyzerMetrics['topWebFilterCategories']) ?? [],
      topWebFilterUsers: (metrics.topWebFilterUsers as AnalyzerMetrics['topWebFilterUsers']) ?? [],
      topAppControlApps: (metrics.topAppControlApps as AnalyzerMetrics['topAppControlApps']) ?? [],
      topAppControlUsers: (metrics.topAppControlUsers as AnalyzerMetrics['topAppControlUsers']) ?? [],
      webFilterBlocked: (metrics.webFilterBlocked as number) ?? 0,
      appControlBlocked: (metrics.appControlBlocked as number) ?? 0,
      anomalyEvents: (metrics.anomalyEvents as number) ?? 0,
      anomalyDropped: (metrics.anomalyDropped as number) ?? 0,
      topAnomalySources: (metrics.topAnomalySources as AnalyzerMetrics['topAnomalySources']) ?? [],
      topAnomalyTypes: (metrics.topAnomalyTypes as AnalyzerMetrics['topAnomalyTypes']) ?? [],
    },
    created_at: row.created_at as string,
  };
}

export function useAnalyzerData(firewallId?: string) {
  return useQuery({
    queryKey: ['analyzer-snapshots', firewallId],
    queryFn: async () => {
      let query = supabase
        .from('analyzer_snapshots' as any)
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (firewallId) {
        query = query.eq('firewall_id', firewallId);
      }

      const { data, error } = await query as any;
      if (error) throw error;
      return ((data as any[]) || []).map((r) => parseSnapshot(r as Record<string, unknown>));
    },
    enabled: true,
    staleTime: 1000 * 60 * 2,
  });
}

export function useLatestAnalyzerSnapshot(firewallId?: string) {
  return useQuery({
    queryKey: ['analyzer-latest', firewallId],
    queryFn: async () => {
      let query = supabase
        .from('analyzer_snapshots' as any)
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (firewallId) {
        query = query.eq('firewall_id', firewallId);
      }

      const { data, error } = await query as any;
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) return null;
      return parseSnapshot(rows[0] as Record<string, unknown>);
    },
    enabled: true,
    staleTime: 1000 * 30,
  });
}
