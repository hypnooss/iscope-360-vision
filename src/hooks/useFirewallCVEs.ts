import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

async function fetchFirmwareVersions(): Promise<string[]> {
  // Get the latest analysis for each firewall and extract firmwareVersion
  const { data, error } = await supabase
    .from('analysis_history')
    .select('firewall_id, report_data, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get distinct latest firmware versions per firewall
  const latestPerFirewall = new Map<string, string>();
  for (const row of data) {
    if (latestPerFirewall.has(row.firewall_id)) continue;
    const reportData = row.report_data as Record<string, unknown> | null;
    const version = reportData?.firmwareVersion as string | undefined;
    if (version) {
      latestPerFirewall.set(row.firewall_id, version);
    }
  }

  // Return unique versions
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
  return useQuery({
    queryKey: ['firewall-cves'],
    queryFn: async () => {
      const versions = await fetchFirmwareVersions();

      if (versions.length === 0) {
        return { cves: [] as FirewallCVE[], versions: [] as string[] };
      }

      // Fetch CVEs for all versions in parallel
      const results = await Promise.all(versions.map(fetchCVEsForVersion));
      const allCves = results.flat();

      // Deduplicate by CVE id (same CVE may appear for multiple versions)
      const seen = new Map<string, FirewallCVE>();
      for (const cve of allCves) {
        if (!seen.has(cve.id)) {
          seen.set(cve.id, cve);
        }
      }

      // Sort by score descending
      const dedupedCves = [...seen.values()].sort((a, b) => b.score - a.score);

      return { cves: dedupedCves, versions };
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
