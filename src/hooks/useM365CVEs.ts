import { useQuery } from '@tanstack/react-query';

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

      const res = await fetch(
        `https://akbosdbyheezghieiefz.supabase.co/functions/v1/m365-cves?${params.toString()}`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch CVEs: ${res.status}`);
      }

      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}
