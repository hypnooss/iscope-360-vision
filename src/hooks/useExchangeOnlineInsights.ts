import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExchangeInsight, ExoInsightsSummary, ExoInsightCategory, AffectedMailbox } from '@/types/exchangeInsights';

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

      // Map raw insights to ExchangeInsight format
      const exchangeInsights: ExchangeInsight[] = allInsights
        .filter(
          (insight: any) =>
            insight.category?.includes('email') ||
            insight.category?.includes('exchange') ||
            insight.category?.includes('mail_flow') ||
            insight.category?.includes('mailbox') ||
            insight.product === 'exchange'
        )
        .map((insight: any) => {
          // Map category to ExoInsightCategory
          let mappedCategory: ExoInsightCategory = 'mail_flow';
          if (insight.category?.includes('mailbox') || insight.id?.includes('forwarding')) {
            mappedCategory = 'mailbox_access';
          } else if (insight.id?.includes('dkim') || insight.id?.includes('dmarc') || insight.id?.includes('spf')) {
            mappedCategory = 'security_hygiene';
          } else if (insight.id?.includes('policy') || insight.id?.includes('filter')) {
            mappedCategory = 'security_policies';
          } else if (insight.id?.includes('rule') || insight.id?.includes('transport')) {
            mappedCategory = 'governance';
          }

          // Map affectedEntities to affectedMailboxes
          const affectedEntities = insight.affectedEntities || [];
          const affectedMailboxes: AffectedMailbox[] = affectedEntities.map((entity: any, idx: number) => ({
            id: `${insight.id}-${idx}`,
            displayName: entity.name || 'Unknown',
            userPrincipalName: entity.name || '',
            details: {
              ruleName: entity.details,
            },
          }));

          return {
            id: insight.id,
            code: insight.id,
            title: insight.name || insight.title || '',
            description: insight.description || '',
            category: mappedCategory,
            severity: insight.severity || 'info',
            affectedCount: affectedEntities.length || insight.rawData?.forwardingCount || insight.rawData?.total || 0,
            affectedMailboxes,
            criteria: insight.details || '',
            recommendation: insight.recommendation || '',
            detectedAt: data.completed_at || new Date().toISOString(),
          } as ExchangeInsight;
        });

      // Calculate summary based on severity
      const calculatedSummary: ExoInsightsSummary = {
        critical: exchangeInsights.filter(i => i.severity === 'critical').length,
        high: exchangeInsights.filter(i => i.severity === 'high').length,
        medium: exchangeInsights.filter(i => i.severity === 'medium').length,
        low: exchangeInsights.filter(i => i.severity === 'low').length,
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
