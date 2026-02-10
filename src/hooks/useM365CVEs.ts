import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface M365CVE {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  score: number | null;
  products: string[];
  publishedDate: string;
  advisoryUrl: string;
  description: string;
}

interface M365CVEsResponse {
  success: boolean;
  totalCVEs: number;
  cves: M365CVE[];
  months: string[];
  source: string;
  error?: string;
}

export function useM365CVEs(months: number = 3, products?: string[]) {
  return useQuery<M365CVEsResponse>({
    queryKey: ['m365-cves', months, products],
    queryFn: async () => {
      const params = new URLSearchParams({ months: String(months) });
      if (products && products.length > 0) {
        params.set('products', products.join(','));
      }

      const { data, error } = await supabase.functions.invoke('m365-cves', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: null,
      });

      // supabase.functions.invoke doesn't support query params natively,
      // so we call directly
      const baseUrl = `https://akbosdbyheezghieiefz.supabase.co/functions/v1/m365-cves?${params.toString()}`;
      const res = await fetch(baseUrl, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch CVEs: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
    retry: 1,
  });
}
