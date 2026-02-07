import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useTenantConnection, TenantConnection } from '@/hooks/useTenantConnection';
import { TenantStatusCard } from '@/components/m365/TenantStatusCard';
import { TenantConnectionWizard } from '@/components/m365/TenantConnectionWizard';
import { TenantEditDialog } from '@/components/m365/TenantEditDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Plus,
  Link as LinkIcon,
  Info,
  AlertCircle
} from 'lucide-react';

interface LastAnalysis {
  tenant_record_id: string;
  score: number | null;
  status: string;
  created_at: string;
}

export default function TenantConnectionPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { tenants, loading, refetch, testConnection, disconnectTenant, deleteTenant, updateTenant, linkAgent, unlinkAgent } = useTenantConnection();
  const [showWizard, setShowWizard] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantConnection | null>(null);
  const [analyzingTenants, setAnalyzingTenants] = useState<Set<string>>(new Set());

  // Fetch last completed analysis for each tenant
  const tenantIds = useMemo(() => tenants.map(t => t.id), [tenants]);
  
  const { data: analysisHistory, refetch: refetchAnalyses } = useQuery({
    queryKey: ['m365-tenant-analyses', tenantIds],
    queryFn: async () => {
      if (tenantIds.length === 0) return [];
      
      // Get latest completed analysis for each tenant
      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('tenant_record_id, score, status, created_at')
        .in('tenant_record_id', tenantIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching analysis history:', error);
        return [];
      }

      // Return only the most recent analysis per tenant
      const latestByTenant = new Map<string, LastAnalysis>();
      for (const record of data || []) {
        if (!latestByTenant.has(record.tenant_record_id)) {
          latestByTenant.set(record.tenant_record_id, record);
        }
      }
      
      return Array.from(latestByTenant.values());
    },
    enabled: tenantIds.length > 0,
  });

  // Create a map for quick lookup
  const analysisMap = useMemo(() => {
    const map = new Map<string, LastAnalysis>();
    for (const analysis of analysisHistory || []) {
      map.set(analysis.tenant_record_id, analysis);
    }
    return map;
  }, [analysisHistory]);

  // Handle OAuth callback via postMessage from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate message type
      if (event.data?.type !== 'm365-oauth-callback') return;
      
      const { success, partial, tenantId, missingPermissions, error, errorDescription } = event.data;
      
      if (success && !partial) {
        toast({
          title: 'Tenant conectado com sucesso!',
          description: 'A conexão foi estabelecida e as permissões foram validadas.',
        });
        refetch();
      } else if (partial) {
        const missing = missingPermissions?.join(', ') || 'Algumas permissões';
        toast({
          title: 'Tenant conectado (parcial)',
          description: `Conexão OK, mas algumas permissões estão pendentes: ${missing}`,
          variant: 'default',
        });
        refetch();
      } else if (error) {
        toast({
          title: 'Erro na conexão',
          description: errorDescription || error,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetch]);

  // Handle OAuth callback parameters (fallback for direct navigation)
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const missingPermissions = searchParams.get('missing');

    if (success === 'true') {
      toast({
        title: 'Tenant conectado com sucesso!',
        description: 'A conexão foi estabelecida e as permissões foram validadas.',
      });
      refetch();
      setSearchParams({});
    } else if (success === 'partial') {
      toast({
        title: 'Tenant conectado (parcial)',
        description: `Conexão OK, mas algumas permissões estão pendentes: ${missingPermissions?.replace(',', ', ')}`,
        variant: 'default',
      });
      refetch();
      setSearchParams({});
    } else if (error) {
      toast({
        title: 'Erro na conexão',
        description: errorDescription || error,
        variant: 'destructive',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetch]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, hasModuleAccess, navigate]);

  const handleTest = async (tenantId: string) => {
    const result = await testConnection(tenantId);
    if (result.success) {
      toast({
        title: 'Conexão testada',
        description: 'A conexão com o tenant foi validada com sucesso.',
      });
    } else {
      toast({
        title: 'Erro ao testar',
        description: result.error || 'Não foi possível testar a conexão.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleDisconnect = async (tenantId: string) => {
    const result = await disconnectTenant(tenantId);
    if (result.success) {
      toast({
        title: 'Tenant desconectado',
        description: 'O tenant foi desconectado. Você pode reconectá-lo a qualquer momento.',
      });
    } else {
      toast({
        title: 'Erro ao desconectar',
        description: result.error || 'Não foi possível desconectar o tenant.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleDelete = async (tenantId: string) => {
    const result = await deleteTenant(tenantId);
    if (result.success) {
      toast({
        title: 'Tenant excluído',
        description: 'O tenant e todas as suas configurações foram removidos permanentemente.',
      });
    } else {
      toast({
        title: 'Erro ao excluir',
        description: result.error || 'Não foi possível excluir o tenant.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleUpdatePermissions = async (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    try {
      // Get M365 App config to build Admin Consent URL
      const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });

      if (configError || !configData?.app_id) {
        toast({
          title: 'Erro',
          description: 'Não foi possível obter a configuração do M365.',
          variant: 'destructive',
        });
        return;
      }

      // Build state payload
      const getAppBaseUrl = () => {
        const publishedUrl = 'https://iscope360.lovable.app';
        if (import.meta.env.DEV) {
          return window.location.origin;
        }
        return publishedUrl;
      };

      const statePayload = {
        tenant_record_id: tenant.id,
        client_id: tenant.client.id,
        tenant_id: tenant.tenant_id,
        redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
        upgrade_permissions: true, // Flag to indicate this is an upgrade
      };
      const state = btoa(JSON.stringify(statePayload));

      // Build Admin Consent URL
      const callbackUrl = `https://akbosdbyheezghieiefz.supabase.co/functions/v1/m365-oauth-callback`;
      const adminConsentUrl = new URL(`https://login.microsoftonline.com/${tenant.tenant_id}/adminconsent`);
      adminConsentUrl.searchParams.set('client_id', configData.app_id);
      adminConsentUrl.searchParams.set('redirect_uri', callbackUrl);
      adminConsentUrl.searchParams.set('state', state);

      // Open consent window
      window.open(
        adminConsentUrl.toString(),
        'microsoft_auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      toast({
        title: 'Atualização de Permissões',
        description: 'Uma nova janela foi aberta. Autorize as permissões adicionais e depois clique em "Testar" para verificar.',
      });
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível iniciar a atualização de permissões.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setEditingTenant(tenant);
    }
  };

  const handleSaveEdit = async (tenantId: string, updates: { display_name?: string; tenant_domain?: string }) => {
    const result = await updateTenant(tenantId, updates);
    if (result.success) {
      toast({
        title: 'Tenant atualizado',
        description: 'As informações do tenant foram atualizadas com sucesso.',
      });
    } else {
      toast({
        title: 'Erro ao atualizar',
        description: result.error || 'Não foi possível atualizar o tenant.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleAnalyzeComplete = () => {
    refetchAnalyses();
  };

  if (authLoading) return null;

  const connectedTenants = tenants.filter(t => t.connection_status === 'connected' || t.connection_status === 'partial');
  const pendingTenants = tenants.filter(t => t.connection_status === 'pending');
  const disconnectedTenants = tenants.filter(t => t.connection_status === 'disconnected' || t.connection_status === 'failed');

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/tenant-connection' },
          { label: 'Tenants' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tenants Microsoft 365</h1>
            <p className="text-muted-foreground">
              Gerencie os tenants, inicie análises e acompanhe a postura de segurança
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Conectar Tenant
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Conexão Centralizada</p>
                <p className="text-sm text-muted-foreground">
                  A conexão do tenant é compartilhada entre todos os submódulos do Microsoft 365 
                  (Entra ID, SharePoint, Exchange, Defender, Intune). Configure uma vez e 
                  utilize em todos os módulos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenants List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-60" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum tenant conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Conecte um tenant Microsoft 365 para começar a utilizar os submódulos 
                de auditoria e análise de segurança.
              </p>
              <Button onClick={() => setShowWizard(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Conectar Primeiro Tenant
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Connected Tenants */}
            {connectedTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-4 h-4 text-green-500" />
                  <h2 className="text-lg font-semibold">Tenants Conectados</h2>
                  <Badge variant="secondary">{connectedTenants.length}</Badge>
                </div>
                <div className="space-y-4">
                  {connectedTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                      onUpdatePermissions={handleUpdatePermissions}
                      onEdit={handleEdit}
                      lastAnalysis={analysisMap.get(tenant.id) || null}
                      isAnalyzing={analyzingTenants.has(tenant.id)}
                      onAnalyzeComplete={handleAnalyzeComplete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Tenants */}
            {pendingTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-lg font-semibold">Aguardando Consentimento</h2>
                  <Badge variant="secondary">{pendingTenants.length}</Badge>
                </div>
                <div className="space-y-4">
                  {pendingTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      lastAnalysis={analysisMap.get(tenant.id) || null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Disconnected Tenants */}
            {disconnectedTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-muted-foreground">Desconectados</h2>
                  <Badge variant="outline">{disconnectedTenants.length}</Badge>
                </div>
                <div className="space-y-4 opacity-60">
                  {disconnectedTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      lastAnalysis={analysisMap.get(tenant.id) || null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connection Wizard Dialog */}
        <TenantConnectionWizard 
          open={showWizard} 
          onOpenChange={setShowWizard}
          onSuccess={() => {
            setShowWizard(false);
            refetch();
          }}
        />

        {/* Edit Dialog */}
        <TenantEditDialog
          tenant={editingTenant}
          open={!!editingTenant}
          onOpenChange={(open) => !open && setEditingTenant(null)}
          onSave={handleSaveEdit}
          onLinkAgent={linkAgent}
          onUnlinkAgent={unlinkAgent}
        />
      </div>
    </AppLayout>
  );
}
