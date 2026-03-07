import { useState, useEffect, useCallback } from 'react';
import { PERMISSION_DESCRIPTIONS as PERM_DESCRIPTIONS, GRAPH_PERMISSIONS, DIRECTORY_ROLES as DIR_ROLES_LIST } from '@/lib/m365PermissionDescriptions';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Unplug,
  Clock,
  RefreshCw,
  Trash2,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Monitor,
} from 'lucide-react';

const ALL_PERMISSIONS = [...GRAPH_PERMISSIONS, ...DIR_ROLES_LIST];

export default function M365TenantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [waitingForConsent, setWaitingForConsent] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<{ active: boolean; attempt: number; maxAttempts: number } | null>(null);
  const [pollingCancelled, setPollingCancelled] = useState(false);
  // Fetch tenant data
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['m365-tenant-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_tenants')
        .select('*, clients(id, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch permissions
  const { data: permissions = [] } = useQuery({
    queryKey: ['m365-tenant-permissions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_tenant_permissions')
        .select('*')
        .eq('tenant_record_id', id!)
        .order('permission_name');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch linked agent
  const { data: tenantAgent } = useQuery({
    queryKey: ['m365-tenant-agent', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_tenant_agents')
        .select('*, agents(id, name, certificate_thumbprint, azure_certificate_key_id)')
        .eq('tenant_record_id', id!)
        .eq('enabled', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const grantedCount = ALL_PERMISSIONS.filter(p =>
    permissions.find((perm: any) => perm.permission_name === p && perm.status === 'granted')
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Parcial</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'disconnected':
        return <Badge className="bg-muted text-muted-foreground border-border"><Unplug className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-m365-connection', {
        body: { tenant_record_id: id },
      });
      if (error) throw error;
      toast.success('Teste de conexão concluído');
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-edit', id] });
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-permissions', id] });
    } catch (err: any) {
      toast.error('Erro no teste: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setTesting(false);
    }
  };

  // Background polling for permission propagation
  const startPermissionPolling = useCallback(async () => {
    const MAX_ATTEMPTS = 9;
    const INTERVAL_MS = 20000; // 20 seconds
    
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      setPollingStatus({ active: true, attempt, maxAttempts: MAX_ATTEMPTS });
      
      try {
        const { data, error } = await supabase.functions.invoke('validate-m365-connection', {
          body: { tenant_record_id: id },
        });
        if (error) throw error;
        
        queryClient.invalidateQueries({ queryKey: ['m365-tenant-permissions', id] });
        queryClient.invalidateQueries({ queryKey: ['m365-tenant-edit', id] });
        
        // Check if all permissions are granted
        if (data?.all_permissions_granted) {
          setPollingStatus(null);
          toast.success('Todas as permissões foram validadas com sucesso!');
          return;
        }
        
        // If this is the last attempt, stop
        if (attempt === MAX_ATTEMPTS) {
          setPollingStatus(null);
          const missing = data?.missing_permissions?.length || 0;
          toast.warning(
            `${missing} permissão(ões) ainda pendente(s). O Azure AD pode levar até 5 minutos para propagar. Tente "Testar" novamente em alguns minutos.`,
            { duration: 8000 }
          );
          return;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      } catch (err: any) {
        console.error(`Polling attempt ${attempt} failed:`, err);
        if (attempt === MAX_ATTEMPTS) {
          setPollingStatus(null);
          toast.error('Erro ao verificar permissões. Tente novamente.');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
      }
    }
    setPollingStatus(null);
  }, [id, queryClient]);

  // Listen for OAuth popup postMessage (for re-consent flow)
  useEffect(() => {
    if (!waitingForConsent) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'm365-oauth-callback') return;
      
      setWaitingForConsent(false);
      setRevalidating(false);
      
      // Start background polling for permission propagation
      toast.info('Consentimento recebido. Verificando permissões...');
      startPermissionPolling();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [waitingForConsent, startPermissionPolling]);

  const handleRevalidatePermissions = async () => {
    setRevalidating(true);
    try {
      // 1. First validate current permissions
      const { data, error } = await supabase.functions.invoke('validate-m365-permissions', {
        body: { tenant_id: tenant?.tenant_id },
      });
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-permissions', id] });

      const failedRequired = data?.permissions?.filter((r: any) => !r.granted && r.type === 'required')?.length || 0;
      const failedRecommended = data?.permissions?.filter((r: any) => !r.granted && r.type === 'recommended')?.length || 0;
      const totalFailed = failedRequired + failedRecommended;

      if (totalFailed === 0) {
        // All permissions granted in pre-check — but still run validate-m365-connection
        // to sync ALL permissions (including additional ones) in the database
        toast.info('Permissões pré-validadas. Sincronizando status completo...');
        setRevalidating(false);
        startPermissionPolling();
        return;
      }

      // 1.5 Ensure all required permissions are in the App Registration manifest
      try {
        await supabase.functions.invoke('ensure-exchange-permission');
      } catch {
        // non-blocking - continue with consent even if manifest update fails
      }

      // 2. Get app_id to build admin consent URL
      const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });

      if (configError || !configData?.app_id) {
        toast.error('Não foi possível obter a configuração do App. Contate o administrador.');
        setRevalidating(false);
        return;
      }

      // 3. Build admin consent URL and open popup
      const getAppBaseUrl = () => {
        const publishedUrl = 'https://iscope360.lovable.app';
        if (import.meta.env.DEV) return window.location.origin;
        return publishedUrl;
      };

      const statePayload = {
        tenant_record_id: id,
        client_id: tenant?.client_id,
        tenant_id: tenant?.tenant_id,
        redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
      };
      const state = btoa(JSON.stringify(statePayload));
      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/m365-oauth-callback`;

      const adminConsentUrl = new URL(`https://login.microsoftonline.com/${tenant?.tenant_id}/adminconsent`);
      adminConsentUrl.searchParams.set('client_id', configData.app_id);
      adminConsentUrl.searchParams.set('redirect_uri', callbackUrl);
      adminConsentUrl.searchParams.set('state', state);

      window.open(
        adminConsentUrl.toString(),
        'microsoft_auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      setWaitingForConsent(true);
      toast.info(`${totalFailed} permissão(ões) pendente(s). Conceda o acesso na janela da Microsoft.`);
    } catch (err: any) {
      toast.error('Erro ao revalidar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setRevalidating(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('m365_tenants')
        .update({ connection_status: 'disconnected' })
        .eq('id', id!);
      if (error) throw error;
      toast.success('Tenant desconectado');
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-edit', id] });
      setShowDisconnectDialog(false);
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('m365_tenant_agents').delete().eq('tenant_record_id', id!);
      await supabase.from('m365_tenant_permissions').delete().eq('tenant_record_id', id!);
      const { error } = await supabase.from('m365_tenants').delete().eq('id', id!);
      if (error) throw error;
      toast.success('Tenant excluído com sucesso');
      navigate('/environment');
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setDeleting(false);
    }
  };

  if (tenantLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!tenant) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <p className="text-muted-foreground">Tenant não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/environment')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const agent = (tenantAgent as any)?.agents;
  const hasCert = !!(agent?.certificate_thumbprint);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Ambiente', href: '/environment' },
          { label: tenant.display_name || tenant.tenant_domain || 'Tenant' },
        ]} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/environment')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Building className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {tenant.display_name || tenant.tenant_domain || 'Tenant sem nome'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {tenant.tenant_domain || `ID: ${tenant.tenant_id?.slice(0, 12)}...`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Single unified card */}
        <Card className="glass-card">
          <CardContent className="p-6 space-y-6">
            {/* Workspace + Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Workspace</p>
                <p className="text-sm font-medium">{(tenant as any).clients?.name || '—'}</p>
              </div>
              {getStatusBadge(tenant.connection_status)}
            </div>

            {/* Agent para Análise PowerShell */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Agent para Análise PowerShell</p>
              </div>
              {agent ? (
                <div className="rounded-lg py-3 px-4 bg-muted/50 border border-border/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <Badge className={cn(
                      "text-xs",
                      hasCert
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}>
                      {hasCert ? (
                        <><CheckCircle className="w-3 h-3 mr-1" />Cert OK</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3 mr-1" />Pendente</>
                      )}
                    </Badge>
                  </div>
                  {agent.azure_certificate_key_id && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Certificado registrado no Azure</p>
                      <p className="text-xs font-mono text-foreground/70">{agent.azure_certificate_key_id}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum agent vinculado</p>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Permissões ({grantedCount}/{ALL_PERMISSIONS.length})
                </p>
                <p className="text-xs text-muted-foreground mb-3">Permissões do Microsoft Graph</p>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                  {GRAPH_PERMISSIONS.map(permName => {
                    const perm = permissions.find((p: any) => p.permission_name === permName);
                    return (
                      <div key={permName} className="rounded-lg py-2 px-3 bg-muted/50 border border-border/50 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                            perm?.status === 'granted' ? 'bg-green-500' :
                            perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                          )} />
                          <span className="text-xs font-mono font-medium text-foreground truncate">{permName}</span>
                        </div>
                        {PERM_DESCRIPTIONS[permName] && <p className="text-xs text-muted-foreground pl-4 truncate">{PERM_DESCRIPTIONS[permName]}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
                  {DIR_ROLES_LIST.map(roleName => {
                    const perm = permissions.find((p: any) => p.permission_name === roleName);
                    return (
                      <div key={roleName} className="rounded-lg py-2 px-3 bg-muted/50 border border-border/50 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                            perm?.status === 'granted' ? 'bg-green-500' :
                            perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                          )} />
                          <span className="text-xs font-medium text-foreground truncate">{roleName}</span>
                        </div>
                        {PERM_DESCRIPTIONS[roleName] && <p className="text-xs text-muted-foreground pl-4 truncate">{PERM_DESCRIPTIONS[roleName]}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons - right aligned */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || tenant.connection_status === 'disconnected'}>
                {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Testar
              </Button>
              <Button variant="outline" size="sm" onClick={handleRevalidatePermissions} disabled={revalidating || waitingForConsent || !!pollingStatus?.active || tenant.connection_status === 'disconnected'}>
                {(revalidating || waitingForConsent || pollingStatus?.active) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
                {pollingStatus?.active
                  ? `Propagando... (${pollingStatus.attempt}/${pollingStatus.maxAttempts})`
                  : waitingForConsent
                    ? 'Aguardando consentimento...'
                    : 'Revalidar Permissões'}
              </Button>
              <Button
                variant="outline" size="sm"
                className="text-warning hover:text-warning hover:bg-warning/10 border-border"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={tenant.connection_status === 'disconnected'}
              >
                <Unplug className="w-3 h-3 mr-1" />Desconectar
              </Button>
              <Button
                variant="outline" size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disconnect Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar este tenant? As credenciais serão mantidas mas o tenant ficará inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as permissões e configurações serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
