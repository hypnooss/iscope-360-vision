import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CachedCVE {
  id: string;
  cve_id: string;
  source_id: string;
  module_code: string;
  severity: string;
  score: number | null;
  title: string;
  description: string;
  products: string[];
  published_date: string | null;
  advisory_url: string;
  created_at: string;
  updated_at: string;
}

export interface CVESource {
  id: string;
  module_code: string;
  source_type: string;
  source_label: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_count: number;
  created_at: string;
  updated_at: string;
}

export function useCVECache(moduleCode?: string) {
  return useQuery({
    queryKey: ['cve-cache', moduleCode],
    queryFn: async () => {
      let query = supabase
        .from('cve_cache')
        .select('*')
        .order('score', { ascending: false, nullsFirst: false });

      if (moduleCode) {
        query = query.eq('module_code', moduleCode);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        products: Array.isArray(row.products) ? row.products : [],
      })) as CachedCVE[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCVESources() {
  return useQuery({
    queryKey: ['cve-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cve_sources')
        .select('*')
        .order('module_code');

      if (error) throw error;
      return (data || []) as CVESource[];
    },
    staleTime: 1000 * 60 * 2,
  });
}
