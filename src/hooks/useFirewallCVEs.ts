import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';

export interface FirewallCVE {
  id: string;
  description: string;
  affectedVersions?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  score: number;
  publishedDate: string;
  lastModifiedDate: string;
  references: string[];
  firmwareVersion: string;
}

interface FortigateCVEResponse {
  success: boolean;
  version: string;
  totalCVEs: number;
  cves: Omit<FirewallCVE, 'firmwareVersion'>[];
  source: string;
  disclaimer?: string;
  error?: string;
}

async function fetchFirmwareVersions(workspaceIds: string[]): Promise<string[]> {
  // When filtering by workspace, first get firewall IDs for those workspaces
  let firewallIds: string[] | null = null;
  if (workspaceIds.length > 0) {
    const { data: firewalls, error: fwError } = await supabase
      .from('firewalls')
      .select('id')
      .in('client_id', workspaceIds);
    if (fwError) throw fwError;
    if (!firewalls || firewalls.length === 0) return [];
    firewallIds = firewalls.map((f) => f.id);
  }

  let query = supabase
    .from('analysis_history')
    .select('firewall_id, report_data, created_at')
    .order('created_at', { ascending: false });

  if (firewallIds) {
    query = query.in('firewall_id', firewallIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const latestPerFirewall = new Map<string, string>();
  for (const row of data) {
    if (latestPerFirewall.has(row.firewall_id)) continue;
    const reportData = row.report_data as Record<string, unknown> | null;
    const version = reportData?.firmwareVersion as string | undefined;
    if (version) {
      latestPerFirewall.set(row.firewall_id, version);
    }
  }

  return [...new Set(latestPerFirewall.values())];
}

async function fetchCVEsForVersion(version: string): Promise<FirewallCVE[]> {
  const { data, error } = await supabase.functions.invoke<FortigateCVEResponse>('fortigate-cve', {
    body: { version },
  });

  if (error) {
    console.error(`Error fetching CVEs for version ${version}:`, error);
    return [];
  }

  if (!data?.success || !data.cves) return [];

  return data.cves.map((cve) => ({
    ...cve,
    firmwareVersion: version,
  }));
}

export function useFirewallCVEs() {
  const { effectiveWorkspaces, isPreviewMode } = useEffectiveAuth();
  const workspaceIds = isPreviewMode ? effectiveWorkspaces.map((w) => w.id) : [];

  return useQuery({
    queryKey: ['firewall-cves', workspaceIds],
    queryFn: async () => {
      const versions = await fetchFirmwareVersions(workspaceIds);

      if (versions.length === 0) {
        return { cves: [] as FirewallCVE[], versions: [] as string[] };
      }

      const results = await Promise.all(versions.map(fetchCVEsForVersion));
      const allCves = results.flat();

      const seen = new Map<string, FirewallCVE>();
      for (const cve of allCves) {
        if (!seen.has(cve.id)) {
          seen.set(cve.id, cve);
        }
      }

      const dedupedCves = [...seen.values()].sort((a, b) => b.score - a.score);

      return { cves: dedupedCves, versions };
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
