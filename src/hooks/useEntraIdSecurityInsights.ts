import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SecurityInsight, InsightsSummary, SecurityInsightsResponse } from '@/types/securityInsights';

interface UseEntraIdSecurityInsightsOptions {
  tenantRecordId: string | null;
  dateRange?: { from: Date; to: Date };
}

interface UseEntraIdSecurityInsightsResult {
  insights: SecurityInsight[];
  summary: InsightsSummary;
  analyzedPeriod: { from: string; to: string } | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  refresh: () => Promise<void>;
}

export function useEntraIdSecurityInsights({
  tenantRecordId,
  dateRange,
}: UseEntraIdSecurityInsightsOptions): UseEntraIdSecurityInsightsResult {
  const [insights, setInsights] = useState<SecurityInsight[]>([]);
  const [summary, setSummary] = useState<InsightsSummary>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  });
  const [analyzedPeriod, setAnalyzedPeriod] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const requestBody: Record<string, string> = {
        tenant_record_id: tenantRecordId,
      };

      if (dateRange?.from) {
        requestBody.date_from = dateRange.from.toISOString();
      }
      if (dateRange?.to) {
        requestBody.date_to = dateRange.to.toISOString();
      }

      const { data, error: fnError } = await supabase.functions.invoke<SecurityInsightsResponse>(
        'entra-id-security-insights',
        { body: requestBody }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao buscar insights de segurança');
      }

      if (!data?.success) {
        setError(data?.message || data?.error || 'Erro desconhecido');
        setErrorCode(data?.errorCode || null);
        setInsights([]);
        setSummary({ critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
        return;
      }

      setInsights(data.insights || []);
      setSummary(data.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
      setAnalyzedPeriod(data.analyzedPeriod || null);
    } catch (err) {
      console.error('Error fetching security insights:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights');
      setInsights([]);
      setSummary({ critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId, dateRange]);

  return {
    insights,
    summary,
    analyzedPeriod,
    loading,
    error,
    errorCode,
    refresh,
  };
}
