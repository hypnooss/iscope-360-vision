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

      // Check cve_severity_cache to know which modules have CVEs
      const { data: cveCache } = await supabase
        .from('cve_severity_cache')
        .select('module_code, total_cves');

      if (!cveCache || cveCache.length === 0) return result;

      const modulesWithCves = new Set(
        cveCache.filter(r => r.total_cves > 0).map(r => r.module_code)
      );

      // Firewall top CVEs
      if (modulesWithCves.has('firewall')) {
        try {
          const { data } = await supabase.functions.invoke('fortigate-cve', {
            body: { topN: 2 },
          });
          if (data?.success && data.cves) {
            result.firewall = (data.cves as any[])
              .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
              .slice(0, 2)
              .map((c: any) => ({
                id: c.id,
                score: c.score || 0,
                severity: c.severity || 'UNKNOWN',
              }));
          }
        } catch (e) {
          console.warn('Failed to fetch firewall top CVEs:', e);
        }
      }

      // M365 top CVEs
      if (modulesWithCves.has('m365')) {
        try {
          const res = await fetch(
            `https://akbosdbyheezghieiefz.supabase.co/functions/v1/m365-cves?months=3`,
            {
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo',
                'Content-Type': 'application/json',
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data.cves) {
              result.m365 = (data.cves as any[])
                .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                .slice(0, 2)
                .map((c: any) => ({
                  id: c.id,
                  score: c.score || 0,
                  severity: c.severity || 'UNKNOWN',
                }));
            }
          }
        } catch (e) {
          console.warn('Failed to fetch M365 top CVEs:', e);
        }
      }

      return result;
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
