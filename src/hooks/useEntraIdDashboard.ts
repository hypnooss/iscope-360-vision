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
  loginCountriesSuccess: { country: string; count: number }[];
  loginCountriesFailed: { country: string; count: number }[];
  analyzedAt: string;
}

interface UseEntraIdDashboardOptions {
  tenantRecordId: string | null;
}

export function useEntraIdDashboard({ tenantRecordId }: UseEntraIdDashboardOptions) {
  const [data, setData] = useState<EntraIdDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached data from m365_tenants table (fast DB query)
  const loadCache = useCallback(async () => {
    if (!tenantRecordId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: tenant, error: dbError } = await supabase
        .from('m365_tenants')
        .select('entra_dashboard_cache, entra_dashboard_cached_at')
        .eq('id', tenantRecordId)
        .single();

      if (dbError) throw new Error(dbError.message);

      if (tenant?.entra_dashboard_cache) {
        const cache = tenant.entra_dashboard_cache as any;
        setData({
          users: cache.users || { total: 0, signInEnabled: 0, disabled: 0, guests: 0, onPremSynced: 0 },
          admins: cache.admins || { total: 0, globalAdmins: 0 },
          mfa: cache.mfa || { total: 0, enabled: 0, disabled: 0 },
          risks: cache.risks || { riskyUsers: 0, atRisk: 0, compromised: 0 },
          loginActivity: cache.loginActivity || { total: 0, success: 0, failed: 0, mfaRequired: 0, blocked: 0 },
          userChanges: cache.userChanges || { updated: 0, new: 0, enabled: 0, disabled: 0, deleted: 0 },
          passwordActivity: cache.passwordActivity || { resets: 0, forcedChanges: 0, selfService: 0 },
          loginCountriesSuccess: cache.loginCountriesSuccess || [],
          loginCountriesFailed: cache.loginCountriesFailed || [],
          analyzedAt: tenant.entra_dashboard_cached_at || '',
        });
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('useEntraIdDashboard loadCache error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  // Refresh: calls edge function (which saves cache), then reloads from DB
  const mapResultToData = (result: any): EntraIdDashboardData => ({
    users: result.users || { total: 0, signInEnabled: 0, disabled: 0, guests: 0, onPremSynced: 0 },
    admins: result.admins || { total: 0, globalAdmins: 0 },
    mfa: result.mfa || { total: 0, enabled: 0, disabled: 0 },
    risks: result.risks || { riskyUsers: 0, atRisk: 0, compromised: 0 },
    loginActivity: result.loginActivity || { total: 0, success: 0, failed: 0, mfaRequired: 0, blocked: 0 },
    userChanges: result.userChanges || { updated: 0, new: 0, enabled: 0, disabled: 0, deleted: 0 },
    passwordActivity: result.passwordActivity || { resets: 0, forcedChanges: 0, selfService: 0 },
    loginCountriesSuccess: result.loginCountriesSuccess || [],
    loginCountriesFailed: result.loginCountriesFailed || [],
    analyzedAt: result.analyzedAt || '',
  });

  const refresh = useCallback(async () => {
    if (!tenantRecordId) return;
    setRefreshing(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('entra-id-dashboard', {
        body: { tenant_record_id: tenantRecordId },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result?.success) throw new Error(result?.error || 'Erro ao atualizar dashboard');

      // Use data directly from edge function response
      setData(mapResultToData(result));

      // Also try to reload from cache for future visits (non-blocking)
      loadCache().catch(() => {});
    } catch (err) {
      console.error('useEntraIdDashboard refresh error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setRefreshing(false);
    }
  }, [tenantRecordId, loadCache]);

  // Load cache when tenant changes
  useEffect(() => {
    if (tenantRecordId) loadCache();
  }, [tenantRecordId, loadCache]);

  return { data, loading, refreshing, error, refresh };
}
