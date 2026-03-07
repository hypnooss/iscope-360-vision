import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EntraIdDashboardData {
  users: { total: number; signInEnabled: number; disabled: number; guests: number; onPremSynced: number };
  admins: { total: number; globalAdmins: number };
  mfa: { total: number; enabled: number; disabled: number };
  risks: { riskyUsers: number; atRisk: number; compromised: number };
  loginActivity: { total: number; success: number; failed: number; mfaRequired: number; blocked: number };
  userChanges: { updated: number; new: number; enabled: number; disabled: number; deleted: number };
  passwordActivity: { resets: number; forcedChanges: number; selfService: number };
  analyzedAt: string;
}

interface UseEntraIdDashboardOptions {
  tenantRecordId: string | null;
}

export function useEntraIdDashboard({ tenantRecordId }: UseEntraIdDashboardOptions) {
  const [data, setData] = useState<EntraIdDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantRecordId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('entra-id-dashboard', {
        body: { tenant_record_id: tenantRecordId },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result?.success) throw new Error(result?.error || 'Erro ao carregar dashboard');

      setData(result as EntraIdDashboardData);
    } catch (err) {
      console.error('useEntraIdDashboard error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  useEffect(() => {
    if (tenantRecordId) refresh();
  }, [tenantRecordId, refresh]);

  return { data, loading, error, refresh };
}
