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
  vendor: string;
}

export interface VersionInfo {
  version: string;
  vendor: string;
}

interface FirewallCVEResponse {
  success: boolean;
  version: string;
  vendor?: string;
  totalCVEs: number;
  cves: Omit<FirewallCVE, 'firmwareVersion' | 'vendor'>[];
  source: string;
  disclaimer?: string;
  error?: string;
}

const VENDOR_OS_LABELS: Record<string, string> = {
  fortinet: 'FortiOS',
  sonicwall: 'SonicOS',
};

export function getOsLabel(vendor: string): string {
  return VENDOR_OS_LABELS[vendor] || vendor;
}

async function fetchFirmwareVersions(workspaceIds: string[]): Promise<VersionInfo[]> {
  // Get firewalls with their device_type vendor info
  let firewallQuery = supabase
    .from('firewalls')
    .select('id, device_type_id, device_types(vendor)');

  if (workspaceIds.length > 0) {
    firewallQuery = firewallQuery.in('client_id', workspaceIds);
  }

  const { data: firewalls, error: fwError } = await firewallQuery;
  if (fwError) throw fwError;
  if (!firewalls || firewalls.length === 0) return [];

  const firewallIds = firewalls.map((f) => f.id);

  // Build firewall_id -> vendor map
  const firewallVendorMap = new Map<string, string>();
  for (const fw of firewalls) {
    const deviceType = fw.device_types as { vendor: string } | null;
    const vendor = deviceType?.vendor?.toLowerCase() || 'fortinet';
    firewallVendorMap.set(fw.id, vendor);
  }

  const { data, error } = await supabase
    .from('analysis_history')
    .select('firewall_id, report_data, created_at')
    .in('firewall_id', firewallIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Get latest firmware per firewall
  const latestPerFirewall = new Map<string, { version: string; vendor: string }>();
  for (const row of data) {
    if (latestPerFirewall.has(row.firewall_id)) continue;
    const reportData = row.report_data as Record<string, unknown> | null;
    const version = reportData?.firmwareVersion as string | undefined;
    if (version) {
      const vendor = firewallVendorMap.get(row.firewall_id) || 'fortinet';
      latestPerFirewall.set(row.firewall_id, { version, vendor });
    }
  }

  // Deduplicate by version+vendor
  const seen = new Set<string>();
  const results: VersionInfo[] = [];
  for (const info of latestPerFirewall.values()) {
    const key = `${info.vendor}:${info.version}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(info);
    }
  }

  return results;
}

async function fetchCVEsForVersion(info: VersionInfo): Promise<FirewallCVE[]> {
  const { data, error } = await supabase.functions.invoke<FirewallCVEResponse>('fortigate-cve', {
    body: { version: info.version, vendor: info.vendor },
  });

  if (error) {
    console.error(`Error fetching CVEs for ${info.vendor} ${info.version}:`, error);
    return [];
  }

  if (!data?.success || !data.cves) return [];

  return data.cves.map((cve) => ({
    ...cve,
    firmwareVersion: info.version,
    vendor: info.vendor,
  }));
}

export function useFirewallCVEs() {
  const { effectiveWorkspaces, isPreviewMode } = useEffectiveAuth();
  const workspaceIds = isPreviewMode ? effectiveWorkspaces.map((w) => w.id) : [];

  return useQuery({
    queryKey: ['firewall-cves', workspaceIds],
    queryFn: async () => {
      const versionInfos = await fetchFirmwareVersions(workspaceIds);

      if (versionInfos.length === 0) {
        return {
          cves: [] as FirewallCVE[],
          versions: [] as string[],
          versionInfos: [] as VersionInfo[],
          vendors: [] as string[],
        };
      }

      const results = await Promise.all(versionInfos.map(fetchCVEsForVersion));
      const allCves = results.flat();

      const seen = new Map<string, FirewallCVE>();
      for (const cve of allCves) {
        if (!seen.has(cve.id)) {
          seen.set(cve.id, cve);
        }
      }

      const dedupedCves = [...seen.values()].sort((a, b) => b.score - a.score);
      const vendors = [...new Set(versionInfos.map((v) => v.vendor))];

      return {
        cves: dedupedCves,
        versions: versionInfos.map((v) => v.version),
        versionInfos,
        vendors,
      };
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
