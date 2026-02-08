import { useState, useCallback } from 'react';
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
  error: string | null;
  refetch: () => Promise<void>;
  getInsightsByCategory: (category: M365RiskCategory) => M365Insight[];
  getFailedInsights: () => M365Insight[];
  getCriticalInsights: () => M365Insight[];
  /** Agent-collected insights (Exchange, SharePoint via PowerShell) */
  agentInsights: M365AgentInsight[];
  /** Agent task status */
  agentStatus: string | null;
  /** Check if agent data is still loading */
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

  const refetch = useCallback(async () => {
    if (!tenantRecordId) {
      setError('Tenant não selecionado');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Trigger the analysis (creates agent task + runs Graph API analysis)
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke(
        'trigger-m365-posture-analysis',
        {
          body: { tenant_record_id: tenantRecordId },
        }
      );

      if (triggerError) {
        throw new Error(triggerError.message || 'Erro ao disparar análise');
      }

      if (!triggerData.success) {
        throw new Error(triggerData.error || 'Erro desconhecido');
      }

      const analysisId = triggerData.analysis_id;
      console.log('[useM365SecurityPosture] Analysis triggered:', analysisId, 'has_agent:', triggerData.has_agent);

      // Poll for results (Graph API analysis runs in background)
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      const pollInterval = 1000; // 1 second

      const pollForResults = async (): Promise<M365PostureResponse | null> => {
        const { data: historyRecord, error: historyError } = await supabase
          .from('m365_posture_history')
          .select('*')
          .eq('id', analysisId)
          .single();

        if (historyError) {
          console.error('[useM365SecurityPosture] Error fetching history:', historyError);
          return null;
        }

        // Check if Graph API analysis is complete
        if (historyRecord.status === 'completed' || historyRecord.status === 'failed') {
          // Transform to M365PostureResponse format
          const response: M365PostureResponse = {
            success: historyRecord.status === 'completed',
            error: historyRecord.status === 'failed' ? (historyRecord.errors as any)?.message : undefined,
            score: historyRecord.score ?? 0,
            classification: historyRecord.classification as any ?? 'critical',
            summary: (historyRecord.summary as any) ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
            categoryBreakdown: (historyRecord.category_breakdown as any) ?? [],
            insights: (historyRecord.insights as any) ?? [],
            agentInsights: (historyRecord.agent_insights as any) ?? [],
            agentStatus: historyRecord.agent_status as M365PostureResponse['agentStatus'],
            tenant: triggerData.tenant,
            analyzedAt: historyRecord.completed_at ?? historyRecord.created_at ?? new Date().toISOString(),
            analyzedPeriod: { from: dateFrom ?? '', to: dateTo ?? '' },
            errors: (historyRecord.errors as any)?.errors ?? [],
          };

          return response;
        }

        return null;
      };

      // Initial poll
      let result = await pollForResults();
      
      // If not ready, keep polling
      while (!result && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        result = await pollForResults();
        attempts++;
      }

      if (!result) {
        throw new Error('Timeout aguardando análise completar');
      }

      setData(result);

      // Notify about agent status
      if (triggerData.has_agent && result.agentStatus === 'pending') {
        toast({
          title: 'Coleta via Agent em andamento',
          description: 'Dados do Exchange e SharePoint serão atualizados quando o agent completar.',
          variant: 'default',
        });
      }

      // Notify about errors in collectors
      if (result.errors && result.errors.length > 0) {
        toast({
          title: 'Análise parcial',
          description: `Alguns coletores tiveram problemas: ${result.errors.length} erro(s)`,
          variant: 'default',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar postura de segurança';
      setError(message);
      toast({
        title: 'Erro na análise',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [tenantRecordId, dateFrom, dateTo, toast]);

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
    error,
    refetch,
    getInsightsByCategory,
    getFailedInsights,
    getCriticalInsights,
    agentInsights,
    agentStatus,
    isAgentPending,
  };
}
