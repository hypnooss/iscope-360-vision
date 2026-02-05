import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  M365PostureResponse, 
  M365Insight,
  M365RiskCategory,
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
      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        'm365-security-posture',
        {
          body: {
            tenant_record_id: tenantRecordId,
            date_from: dateFrom,
            date_to: dateTo,
          },
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || 'Erro ao chamar Edge Function');
      }

      if (!responseData.success) {
        throw new Error(responseData.error || 'Erro desconhecido');
      }

      setData(responseData as M365PostureResponse);

      // Notify about errors in collectors
      if (responseData.errors && responseData.errors.length > 0) {
        toast({
          title: 'Análise parcial',
          description: `Alguns coletores tiveram problemas: ${responseData.errors.length} erro(s)`,
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

  return {
    data,
    isLoading,
    error,
    refetch,
    getInsightsByCategory,
    getFailedInsights,
    getCriticalInsights,
  };
}
