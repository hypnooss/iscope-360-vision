import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExchangeInsight, ExoInsightsSummary, ExchangeInsightsResponse } from '@/types/exchangeInsights';

interface UseExchangeOnlineInsightsOptions {
  tenantRecordId: string | null;
}

interface UseExchangeOnlineInsightsResult {
  insights: ExchangeInsight[];
  summary: ExoInsightsSummary;
  analyzedAt: string | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  refresh: () => Promise<void>;
}

export function useExchangeOnlineInsights({
  tenantRecordId,
}: UseExchangeOnlineInsightsOptions): UseExchangeOnlineInsightsResult {
  const [insights, setInsights] = useState<ExchangeInsight[]>([]);
  const [summary, setSummary] = useState<ExoInsightsSummary>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0,
  });
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
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
      const { data, error: fnError } = await supabase.functions.invoke<ExchangeInsightsResponse>(
        'exchange-online-insights',
        { body: { tenant_record_id: tenantRecordId } }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao buscar insights do Exchange Online');
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
      setAnalyzedAt(data.analyzedAt || null);
    } catch (err) {
      console.error('Error fetching Exchange Online insights:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights');
      setInsights([]);
      setSummary({ critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  return {
    insights,
    summary,
    analyzedAt,
    loading,
    error,
    errorCode,
    refresh,
  };
}
