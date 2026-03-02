import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  M365PostureResponse, 
  M365Insight,
  M365RiskCategory,
  M365AgentInsight,
} from '@/types/m365Insights';
import { useToast } from '@/hooks/use-toast';

interface UseM365SecurityPostureOptions {
  tenantRecordId: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseM365SecurityPostureReturn {
  data: M365PostureResponse | null;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  error: string | null;
  refetch: () => Promise<void>;
  triggerAnalysis: () => Promise<{ success: boolean; analysisId?: string }>;
  getInsightsByCategory: (category: M365RiskCategory) => M365Insight[];
  getFailedInsights: () => M365Insight[];
  getCriticalInsights: () => M365Insight[];
  agentInsights: M365AgentInsight[];
  agentStatus: string | null;
  isAgentPending: boolean;
}

export function useM365SecurityPosture({
  tenantRecordId,
  dateFrom,
  dateTo,
}: UseM365SecurityPostureOptions): UseM365SecurityPostureReturn {
  const [data, setData] = useState<M365PostureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch latest analysis from history (no API call)
  const refetch = useCallback(async () => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use RPC to get insights without full affectedEntities (70-90% payload reduction)
      const { data: liteData, error: rpcError } = await supabase.rpc('get_posture_insights_lite', {
        p_tenant_record_id: tenantRecordId,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!liteData) {
        setData(null);
        setError('Nenhuma análise encontrada. Clique em "Atualizar" para executar.');
        return;
      }

      const historyRecord = liteData as any;

      // Transform to M365PostureResponse format
      const response: M365PostureResponse = {
        success: true,
        score: historyRecord.score ?? 0,
        classification: historyRecord.classification as any ?? 'critical',
        summary: historyRecord.summary ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        categoryBreakdown: historyRecord.category_breakdown ?? [],
        insights: historyRecord.insights ?? [],
        agentInsights: historyRecord.agent_insights ?? [],
        agentStatus: historyRecord.agent_status as M365PostureResponse['agentStatus'],
        tenant: {
          id: tenantRecordId,
          domain: '',
          displayName: '',
        },
        analyzedAt: historyRecord.completed_at ?? historyRecord.created_at ?? new Date().toISOString(),
        analyzedPeriod: { from: dateFrom ?? '', to: dateTo ?? '' },
        errors: historyRecord.errors?.errors ?? [],
        _historyId: historyRecord.id,
      };

      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar postura de segurança';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [tenantRecordId, dateFrom, dateTo]);

  // Trigger a new analysis (calls edge function) — returns analysisId for external polling
  const triggerAnalysis = useCallback(async (): Promise<{ success: boolean; analysisId?: string }> => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke(
        'trigger-m365-posture-analysis',
        { body: { tenant_record_id: tenantRecordId } }
      );

      if (triggerError) {
        throw new Error(triggerError.message || 'Erro ao disparar análise');
      }

      if (!triggerData.success) {
        throw new Error(triggerData.error || 'Erro desconhecido');
      }

      const analysisId = triggerData.analysis_id;
      console.log('[useM365SecurityPosture] Analysis triggered:', analysisId);

      // Return immediately — polling is handled by the page component
      return { success: true, analysisId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar postura de segurança';
      setError(message);
      setIsLoading(false);
      toast({
        title: 'Erro na análise',
        description: message,
        variant: 'destructive',
      });
      return { success: false };
    }
  }, [tenantRecordId, toast]);

  // Auto-fetch when tenant changes
  useEffect(() => {
    if (tenantRecordId) {
      refetch();
    }
  }, [tenantRecordId, refetch]);

  const getInsightsByCategory = useCallback(
    (category: M365RiskCategory): M365Insight[] => {
      if (!data?.insights) return [];
      return data.insights.filter((insight) => insight.category === category);
    },
    [data]
  );

  const getFailedInsights = useCallback((): M365Insight[] => {
    if (!data?.insights) return [];
    return data.insights.filter((insight) => insight.status === 'fail');
  }, [data]);

  const getCriticalInsights = useCallback((): M365Insight[] => {
    if (!data?.insights) return [];
    return data.insights.filter(
      (insight) => insight.status === 'fail' && insight.severity === 'critical'
    );
  }, [data]);

  // Derived agent state
  const agentInsights = data?.agentInsights ?? [];
  const agentStatus = data?.agentStatus ?? null;
  const isAgentPending = agentStatus === 'pending' || agentStatus === 'running';

  return {
    data,
    isLoading,
    setIsLoading,
    error,
    refetch,
    triggerAnalysis,
    getInsightsByCategory,
    getFailedInsights,
    getCriticalInsights,
    agentInsights,
    agentStatus,
    isAgentPending,
  };
}
