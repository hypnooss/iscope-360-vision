import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePreview } from '@/contexts/PreviewContext';
import { supabase } from '@/integrations/supabase/client';

export interface TenantOption {
  id: string;
  displayName: string;
  domain: string;
}

export function useM365TenantSelector() {
  const { user } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);

  const paramTenantId = searchParams.get('tenant');

  const loadTenants = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      let query = supabase
        .from('m365_tenants')
        .select('id, display_name, tenant_domain, client_id')
        .in('connection_status', ['connected', 'partial']);

      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading tenants:', error);
        return;
      }

      const options: TenantOption[] = (data || []).map(t => ({
        id: t.id,
        displayName: t.display_name || 'Tenant M365',
        domain: t.tenant_domain || '',
      }));

      setTenants(options);

      // Auto-select first tenant if no param in URL
      if (!paramTenantId && options.length > 0) {
        setSearchParams({ tenant: options[0].id }, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [user, isPreviewMode, previewTarget, paramTenantId, setSearchParams]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const selectedTenantId = paramTenantId && tenants.some(t => t.id === paramTenantId)
    ? paramTenantId
    : tenants.length > 0 ? tenants[0].id : null;

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null;

  const selectTenant = useCallback((id: string) => {
    setSearchParams({ tenant: id });
  }, [setSearchParams]);

  return {
    tenants,
    selectedTenantId,
    selectedTenant,
    selectTenant,
    loading,
  };
}
