import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExchangeInsight, ExoInsightsSummary } from '@/types/exchangeInsights';

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
  triggerAnalysis: () => Promise<{ success: boolean; analysisId?: string }>;
}

const defaultSummary: ExoInsightsSummary = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0,
  total: 0,
};

export function useExchangeOnlineInsights({
  tenantRecordId,
}: UseExchangeOnlineInsightsOptions): UseExchangeOnlineInsightsResult {
  const [insights, setInsights] = useState<ExchangeInsight[]>([]);
  const [summary, setSummary] = useState<ExoInsightsSummary>(defaultSummary);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Fetch latest analysis from history (no API call)
  const refresh = useCallback(async () => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const { data, error: queryError } = await supabase
        .from('m365_posture_history')
        .select('insights, agent_insights, completed_at, status')
        .eq('tenant_record_id', tenantRecordId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (!data) {
        setInsights([]);
        setSummary(defaultSummary);
        setAnalyzedAt(null);
        setError('Nenhuma análise encontrada. Clique em "Reanalisar" para executar.');
        setErrorCode('NO_ANALYSIS');
        return;
      }

      // Filter insights related to Exchange (email category)
      const allInsights = [
        ...((data.insights as any[]) || []),
        ...((data.agent_insights as any[]) || []),
      ];

      const exchangeInsights: ExchangeInsight[] = allInsights.filter(
        (insight: any) =>
          insight.category?.includes('email') ||
          insight.category?.includes('exchange') ||
          insight.category?.includes('mail_flow') ||
          insight.category?.includes('mailbox') ||
          insight.product === 'exchange'
      );

      // Calculate summary based on severity and affectedCount
      const calculatedSummary: ExoInsightsSummary = {
        critical: exchangeInsights.filter(i => i.severity === 'critical' && (i.affectedCount > 0 || (i as any).status === 'fail')).length,
        high: exchangeInsights.filter(i => i.severity === 'high' && (i.affectedCount > 0 || (i as any).status === 'fail')).length,
        medium: exchangeInsights.filter(i => i.severity === 'medium' && (i.affectedCount > 0 || (i as any).status === 'fail')).length,
        low: exchangeInsights.filter(i => i.severity === 'low' && (i.affectedCount > 0 || (i as any).status === 'fail')).length,
        info: exchangeInsights.filter(i => i.severity === 'info').length,
        total: exchangeInsights.length,
      };

      setInsights(exchangeInsights);
      setSummary(calculatedSummary);
      setAnalyzedAt(data.completed_at);
    } catch (err) {
      console.error('Error fetching Exchange Online insights from history:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights');
      setInsights([]);
      setSummary(defaultSummary);
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  // Trigger a new analysis (calls edge function)
  const triggerAnalysis = useCallback(async (): Promise<{ success: boolean; analysisId?: string }> => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'trigger-m365-posture-analysis',
        { body: { tenant_record_id: tenantRecordId } }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao disparar análise');
      }

      // Poll for completion
      const analysisId = data.analysis_id;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: historyRecord } = await supabase
          .from('m365_posture_history')
          .select('status')
          .eq('id', analysisId)
          .single();

        if (historyRecord?.status === 'completed' || historyRecord?.status === 'failed') {
          break;
        }
        attempts++;
      }

      // Refetch to get latest data
      await refresh();
      return { success: true, analysisId };
    } catch (err) {
      console.error('Error triggering analysis:', err);
      setError(err instanceof Error ? err.message : 'Erro ao disparar análise');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId, refresh]);

  // Auto-fetch when tenant changes
  useEffect(() => {
    if (tenantRecordId) {
      refresh();
    }
  }, [tenantRecordId, refresh]);

  return {
    insights,
    summary,
    analyzedAt,
    loading,
    error,
    errorCode,
    refresh,
    triggerAnalysis,
  };
}
