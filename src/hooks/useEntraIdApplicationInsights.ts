import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ApplicationInsight, AppInsightsSummary, ApplicationInsightsResponse } from '@/types/applicationInsights';

interface UseEntraIdApplicationInsightsOptions {
  tenantRecordId: string | null;
}

interface UseEntraIdApplicationInsightsResult {
  insights: ApplicationInsight[];
  summary: AppInsightsSummary;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  refresh: () => Promise<void>;
}

const defaultSummary: AppInsightsSummary = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  total: 0,
  expiredCredentials: 0,
  expiringIn30Days: 0,
  privilegedApps: 0,
};

export function useEntraIdApplicationInsights({
  tenantRecordId,
}: UseEntraIdApplicationInsightsOptions): UseEntraIdApplicationInsightsResult {
  const [insights, setInsights] = useState<ApplicationInsight[]>([]);
  const [summary, setSummary] = useState<AppInsightsSummary>(defaultSummary);
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
      const { data, error: fnError } = await supabase.functions.invoke<ApplicationInsightsResponse>(
        'entra-id-application-insights',
        { body: { tenant_record_id: tenantRecordId } }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao buscar insights de aplicativos');
      }

      if (!data?.success) {
        setError(data?.message || data?.error || 'Erro desconhecido');
        setErrorCode(data?.errorCode || null);
        setInsights([]);
        setSummary(defaultSummary);
        return;
      }

      setInsights(data.insights || []);
      setSummary(data.summary || defaultSummary);
    } catch (err) {
      console.error('Error fetching application insights:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights');
      setInsights([]);
      setSummary(defaultSummary);
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  return {
    insights,
    summary,
    loading,
    error,
    errorCode,
    refresh,
  };
}
