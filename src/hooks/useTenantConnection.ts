import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TenantConnection {
  id: string;
  tenant_id: string;
  tenant_domain: string | null;
  display_name: string | null;
  connection_status: 'pending' | 'connected' | 'partial' | 'failed' | 'disconnected';
  last_validated_at: string | null;
  created_at: string;
  client: {
    id: string;
    name: string;
  };
}

export interface RequiredPermission {
  id: string;
  permission_name: string;
  permission_type: string;
  description: string | null;
  is_required: boolean;
  submodule: string;
}

export function useTenantConnection() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('m365_tenants')
        .select(`
          id,
          tenant_id,
          tenant_domain,
          display_name,
          connection_status,
          last_validated_at,
          created_at,
          clients!inner(id, name)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedData = (data || []).map((t: any) => ({
        ...t,
        client: t.clients
      }));

      setTenants(formattedData);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
      setError(err.message || 'Erro ao carregar tenants');
    } finally {
      setLoading(false);
    }
  };

  const disconnectTenant = async (tenantId: string) => {
    try {
      const { error } = await supabase
        .from('m365_tenants')
        .update({ connection_status: 'disconnected' })
        .eq('id', tenantId);

      if (error) throw error;

      // Log the disconnection
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant) {
        await supabase.from('m365_audit_logs').insert({
          tenant_record_id: tenantId,
          client_id: tenant.client.id,
          user_id: user?.id,
          action: 'disconnect',
          action_details: { reason: 'user_initiated' },
        });
      }

      await fetchTenants();
      return { success: true };
    } catch (err: any) {
      console.error('Error disconnecting tenant:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteTenant = async (tenantId: string) => {
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      
      // Log before deletion (while we still have tenant_record_id)
      if (tenant) {
        await supabase.from('m365_audit_logs').insert({
          tenant_record_id: null, // Set to null since tenant will be deleted
          client_id: tenant.client.id,
          user_id: user?.id,
          action: 'delete',
          action_details: { 
            reason: 'user_initiated',
            deleted_tenant_id: tenant.tenant_id,
            deleted_tenant_domain: tenant.tenant_domain,
            deleted_display_name: tenant.display_name,
          },
        });
      }

      // Delete related records first (cascade should handle this, but being explicit)
      // Delete tenant permissions
      await supabase
        .from('m365_tenant_permissions')
        .delete()
        .eq('tenant_record_id', tenantId);

      // Delete tenant submodules
      await supabase
        .from('m365_tenant_submodules')
        .delete()
        .eq('tenant_record_id', tenantId);

      // Delete app credentials
      await supabase
        .from('m365_app_credentials')
        .delete()
        .eq('tenant_record_id', tenantId);

      // Delete tokens
      await supabase
        .from('m365_tokens')
        .delete()
        .eq('tenant_record_id', tenantId);

      // Finally delete the tenant record
      const { error } = await supabase
        .from('m365_tenants')
        .delete()
        .eq('id', tenantId);

      if (error) throw error;

      await fetchTenants();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      return { success: false, error: err.message };
    }
  };

  const testConnection = async (tenantId: string) => {
    // This would call an edge function to test the Graph API connection
    // For now, just update the last_validated_at timestamp
    try {
      const { error } = await supabase
        .from('m365_tenants')
        .update({ last_validated_at: new Date().toISOString() })
        .eq('id', tenantId);

      if (error) throw error;
      
      await fetchTenants();
      return { success: true };
    } catch (err: any) {
      console.error('Error testing connection:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [user]);

  return {
    tenants,
    loading,
    error,
    refetch: fetchTenants,
    disconnectTenant,
    deleteTenant,
    testConnection,
    hasConnectedTenant: tenants.some(t => t.connection_status === 'connected' || t.connection_status === 'partial'),
  };
}

type M365Submodule = 'entra_id' | 'sharepoint' | 'exchange' | 'defender' | 'intune';

export function useRequiredPermissions(submodule?: M365Submodule) {
  const [permissions, setPermissions] = useState<RequiredPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        let query = supabase
          .from('m365_required_permissions')
          .select('id, permission_name, permission_type, description, is_required, submodule')
          .order('is_required', { ascending: false });

        if (submodule) {
          query = query.eq('submodule', submodule);
        }

        const { data, error } = await query;

        if (error) throw error;
        setPermissions(data || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [submodule]);

  return { permissions, loading };
}
