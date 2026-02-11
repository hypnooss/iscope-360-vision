import { useFirewallCVEs } from '@/hooks/useFirewallCVEs';
import { useM365CVEs } from '@/hooks/useM365CVEs';

export interface TopCVE {
  id: string;
  score: number;
  severity: string;
}

export function useTopCVEs(): Record<string, TopCVE[]> {
  const { data: fwData } = useFirewallCVEs();
  const { data: m365Data } = useM365CVEs();

  const result: Record<string, TopCVE[]> = {};

  if (fwData?.cves && fwData.cves.length > 0) {
    result.firewall = fwData.cves
      .filter((c) => c.score != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((c) => ({ id: c.id, score: c.score, severity: c.severity }));
  }

  if (m365Data?.cves && m365Data.cves.length > 0) {
    result.m365 = m365Data.cves
      .filter((c) => c.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2)
      .map((c) => ({ id: c.id, score: c.score ?? 0, severity: c.severity }));
  }

  return result;
}
