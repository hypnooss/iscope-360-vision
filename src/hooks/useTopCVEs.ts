import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface TopCVE {
  id: string;
  score: number;
  severity: string;
}

export function useTopCVEs(clientIds?: string[]): Record<string, TopCVE[]> {
  const { data } = useQuery({
    queryKey: ['top-cves-cache', clientIds ?? []],
    queryFn: async () => {
      let query = supabase
        .from('cve_severity_cache')
        .select('module_code, top_cves');

      if (clientIds && clientIds.length > 0) {
        query = query.or(
          `client_id.in.(${clientIds.join(',')}),client_id.is.null`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const result: Record<string, TopCVE[]> = {};

  if (data) {
    for (const row of data) {
      const topCves = row.top_cves as Json;
      if (!Array.isArray(topCves) || topCves.length === 0) continue;

      const parsed: TopCVE[] = topCves
        .filter((c): c is { id: string; score: number; severity: string } =>
          typeof c === 'object' && c !== null && 'id' in c && 'score' in c
        )
        .map((c) => ({ id: c.id, score: c.score, severity: c.severity }));

      if (parsed.length > 0) {
        result[row.module_code] = parsed;
      }
    }
  }

  return result;
}
