import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TopCVE {
  id: string;
  score: number;
  severity: string;
}

export function useTopCVEs() {
  return useQuery<Record<string, TopCVE[]>>({
    queryKey: ['dashboard-top-cves'],
    queryFn: async () => {
      const result: Record<string, TopCVE[]> = {};

      // Extract top CVEs from the latest analysis reports stored in DB
      try {
        // Firewall: get CVEs from latest analysis_history report_data
        const { data: fwHistory } = await supabase
          .from('analysis_history')
          .select('report_data')
          .order('created_at', { ascending: false })
          .limit(1);

        if (fwHistory?.[0]?.report_data) {
          const report = fwHistory[0].report_data as any;
          // Try multiple paths for CVE data
          const cves: any[] =
            report?.cves ||
            report?.vulnerabilities ||
            report?.results?.cves ||
            report?.results?.vulnerabilities ||
            report?.cve_results ||
            [];
          if (cves.length > 0) {
            result.firewall = cves
              .sort((a, b) => (b.cvss_score || b.score || b.cvss || 0) - (a.cvss_score || a.score || a.cvss || 0))
              .slice(0, 2)
              .map(c => ({
                id: c.cve_id || c.id || c.cve || 'N/A',
                score: c.cvss_score || c.score || c.cvss || 0,
                severity: c.severity || (
                  (c.cvss_score || c.score || c.cvss || 0) >= 9 ? 'CRITICAL' :
                  (c.cvss_score || c.score || c.cvss || 0) >= 7 ? 'HIGH' : 'MEDIUM'
                ),
              }));
          }
        }
      } catch (e) {
        console.warn('Failed to extract firewall top CVEs:', e);
      }

      try {
        // M365: get CVEs from cve_severity_cache counts only (no individual CVE data available)
        const { data: m365Cache } = await supabase
          .from('cve_severity_cache')
          .select('*')
          .eq('module_code', 'm365')
          .limit(1);

        if (m365Cache?.[0] && m365Cache[0].total_cves > 0) {
          // We only have counts, not individual CVEs — skip individual listing for M365
        }
      } catch (e) {
        console.warn('Failed to fetch M365 CVE cache:', e);
      }

      return result;
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
