import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CollaborationDashboardData {
  teams: { total: number; public: number; private: number; withGuests: number; privateChannels: number; sharedChannels: number };
  sharepoint: { totalSites: number; activeSites: number; inactiveSites: number; externalSharingEnabled: number; totalLists: number; storageUsedGB: number; storageAllocatedGB: number };
  analyzedAt: string;
}

interface UseCollaborationDashboardOptions {
  tenantRecordId: string | null;
}

export function useCollaborationDashboard({ tenantRecordId }: UseCollaborationDashboardOptions) {
  const [data, setData] = useState<CollaborationDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapToData = (cache: any, cachedAt?: string): CollaborationDashboardData => ({
    teams: cache.teams || { total: 0, public: 0, private: 0, withGuests: 0, privateChannels: 0, sharedChannels: 0 },
    sharepoint: { totalSites: 0, activeSites: 0, inactiveSites: 0, externalSharingEnabled: 0, totalLists: 0, storageUsedGB: 0, storageAllocatedGB: 0, ...(cache.sharepoint || {}) },
    analyzedAt: cache.analyzedAt || cachedAt || '',
  });

  const loadCache = useCallback(async () => {
    if (!tenantRecordId) return;
    setLoading(true);
    setError(null);

    try {
      // Try loading from m365_dashboard_snapshots (new architecture)
      const { data: snapshot, error: snapError } = await supabase
        .from('m365_dashboard_snapshots')
        .select('data, created_at')
        .eq('tenant_record_id', tenantRecordId)
        .eq('dashboard_type', 'collaboration')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!snapError && snapshot?.data) {
        const cache = snapshot.data as any;
        setData(mapToData(cache, snapshot.created_at));
      } else {
        // Fallback to legacy cache columns
        const { data: tenant, error: dbError } = await supabase
          .from('m365_tenants')
          .select('collaboration_dashboard_cache, collaboration_dashboard_cached_at')
          .eq('id', tenantRecordId)
          .single();

        if (dbError) throw new Error(dbError.message);

        if (tenant?.collaboration_dashboard_cache) {
          const cache = tenant.collaboration_dashboard_cache as any;
          setData(mapToData(cache, tenant.collaboration_dashboard_cached_at));
        } else {
          setData(null);
        }
      }
    } catch (err) {
      console.error('useCollaborationDashboard loadCache error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [tenantRecordId]);

  const refresh = useCallback(async () => {
    if (!tenantRecordId) return;
    setRefreshing(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('collaboration-dashboard', {
        body: { tenant_record_id: tenantRecordId },
      });

      if (fnError) throw new Error(fnError.message);
      if (!result?.success) throw new Error(result?.error || 'Erro ao atualizar dashboard');

      setData(mapToData(result));
      loadCache().catch(() => {});
    } catch (err) {
      console.error('useCollaborationDashboard refresh error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setRefreshing(false);
    }
  }, [tenantRecordId, loadCache]);

  useEffect(() => {
    if (tenantRecordId) loadCache();
  }, [tenantRecordId, loadCache]);

  return { data, loading, refreshing, error, refresh };
}
