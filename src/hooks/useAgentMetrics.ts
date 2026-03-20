import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TimeRange = "1h" | "6h" | "24h" | "7d";

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export interface DiskPartition {
  path: string;
  total_gb: number;
  used_gb: number;
  percent: number;
}

export interface AgentMetricRow {
  id: string;
  agent_id: string;
  collected_at: string;
  cpu_percent: number | null;
  cpu_count: number | null;
  load_avg_1m: number | null;
  ram_total_mb: number | null;
  ram_used_mb: number | null;
  ram_percent: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  disk_percent: number | null;
  disk_partitions: DiskPartition[] | null;
  net_bytes_sent: number | null;
  net_bytes_recv: number | null;
  uptime_seconds: number | null;
  hostname: string | null;
  os_info: string | null;
  process_count: number | null;
  monitor_version: string | null;
}

export interface NetworkPoint {
  time: string;
  timestamp: number;
  sentRate: number; // bytes/s
  recvRate: number; // bytes/s
}

export function useAgentMetrics(agentId: string | undefined, timeRange: TimeRange = "1h") {
  return useQuery({
    queryKey: ["agent-metrics", agentId, timeRange],
    queryFn: async () => {
      if (!agentId) return [];

      const since = new Date(Date.now() - TIME_RANGE_MS[timeRange]).toISOString();

      const { data, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .eq("agent_id", agentId)
        .gte("collected_at", since)
        .order("collected_at", { ascending: true })
        .limit(1000);

      if (error) throw error;
      return (data ?? []) as unknown as AgentMetricRow[];
    },
    enabled: !!agentId,
    refetchInterval: 60_000,
  });
}

export function computeNetworkRates(metrics: AgentMetricRow[]): NetworkPoint[] {
  const points: NetworkPoint[] = [];
  for (let i = 1; i < metrics.length; i++) {
    const prev = metrics[i - 1];
    const curr = metrics[i];
    if (
      prev.net_bytes_sent == null || curr.net_bytes_sent == null ||
      prev.net_bytes_recv == null || curr.net_bytes_recv == null ||
      !prev.collected_at || !curr.collected_at
    ) continue;

    const dtSec = (new Date(curr.collected_at).getTime() - new Date(prev.collected_at).getTime()) / 1000;
    if (dtSec <= 0) continue;

    const sentDelta = curr.net_bytes_sent - prev.net_bytes_sent;
    const recvDelta = curr.net_bytes_recv - prev.net_bytes_recv;

    // Skip negative deltas (counter reset)
    if (sentDelta < 0 || recvDelta < 0) continue;

    points.push({
      time: curr.collected_at,
      timestamp: new Date(curr.collected_at).getTime(),
      sentRate: sentDelta / dtSec,
      recvRate: recvDelta / dtSec,
    });
  }
  return points;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
