import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TenantEditDialog } from '@/components/m365/TenantEditDialog';
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
  Pencil,
  Trash2,
  Play,
  Loader2,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERMISSION_CATEGORIES = {
  'Entra ID': [
    'User.Read.All', 'Directory.Read.All', 'Group.Read.All',
    'Application.Read.All', 'AuditLog.Read.All', 'Organization.Read.All', 'Policy.Read.All',
  ],
  'Exchange Online': ['MailboxSettings.Read', 'Mail.Read', 'RoleManagement.ReadWrite.Directory'],
  'SharePoint': ['Sites.Read.All'],
  'Certificados': ['Application.ReadWrite.All'],
  'Outros': ['Reports.Read.All'],
};

const DIRECTORY_ROLES = {
  'Exchange Online': ['Exchange Administrator'],
  'SharePoint': ['SharePoint Administrator'],
};

const ALL_PERMISSIONS = [
  ...Object.values(PERMISSION_CATEGORIES).flat(),
  ...Object.values(DIRECTORY_ROLES).flat(),
];

export default function M365TenantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showPermissions, setShowPermissions] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [revalidating, setRevalidating] = useState(false);

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

  // Fetch last posture analysis
  const { data: lastAnalysis } = useQuery({
    queryKey: ['m365-tenant-last-analysis', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('score, status, created_at')
        .eq('tenant_record_id', id!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch schedule
  const { data: schedule } = useQuery({
    queryKey: ['m365-tenant-schedule', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('m365_analyzer_schedules')
        .select('*')
        .eq('tenant_record_id', id!)
        .eq('is_active', true)
        .maybeSingle();
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

  const handleRevalidatePermissions = async () => {
    setRevalidating(true);
    try {
      const { error } = await supabase.functions.invoke('validate-m365-permissions', {
        body: { tenant_record_id: id },
      });
      if (error) throw error;
      toast.success('Permissões revalidadas');
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-permissions', id] });
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { error } = await supabase.functions.invoke('trigger-m365-posture-analysis', {
        body: { tenant_record_id: id },
      });
      if (error) throw error;
      toast.success('Análise iniciada com sucesso');
      navigate('/scope-m365/executions');
    } catch (err: any) {
      toast.error('Erro ao iniciar análise: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (tenantId: string, updates: { display_name?: string; tenant_domain?: string }) => {
    try {
      const { error } = await supabase.from('m365_tenants').update(updates).eq('id', tenantId);
      if (error) throw error;
      toast.success('Tenant atualizado');
      queryClient.invalidateQueries({ queryKey: ['m365-tenant-edit', id] });
      return { success: true };
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
      return { success: false, error: err.message };
    }
  };

  const canAnalyze = tenant?.connection_status === 'connected' || tenant?.connection_status === 'partial';

  const FREQ_LABELS: Record<string, string> = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', hourly: 'Por hora' };

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
          {getStatusBadge(tenant.connection_status)}
        </div>

        {/* Info Grid */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Workspace</p>
                <p className="text-sm font-medium">{(tenant as any).clients?.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Última Análise</p>
                {lastAnalysis ? (
                  <p className="text-sm font-medium">
                    {format(new Date(lastAnalysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nunca analisado</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
                {lastAnalysis?.score != null ? (
                  <div className="flex items-center gap-2">
                    <TrendingUp className={cn("w-4 h-4",
                      lastAnalysis.score >= 80 ? "text-green-500" :
                      lastAnalysis.score >= 60 ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className={cn("text-sm font-bold",
                      lastAnalysis.score >= 80 ? "text-green-500" :
                      lastAnalysis.score >= 60 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {lastAnalysis.score}%
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Agendamento</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={schedule ? 'text-foreground' : 'text-muted-foreground'}>
                    {schedule ? FREQ_LABELS[schedule.frequency] || schedule.frequency : 'Não configurado'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Section */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <button
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                Permissões ({grantedCount}/{ALL_PERMISSIONS.length})
              </span>
              {showPermissions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showPermissions && (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Permissões do Microsoft Graph</p>
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{category}</p>
                        <ul className="text-sm space-y-1">
                          {perms.map(permName => {
                            const perm = permissions.find((p: any) => p.permission_name === permName);
                            return (
                              <li key={permName} className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                                  perm?.status === 'granted' ? 'bg-green-500' :
                                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                                )} />
                                <span className="text-xs truncate">{permName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
                  <div className="grid gap-4 grid-cols-2">
                    {Object.entries(DIRECTORY_ROLES).map(([category, roles]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{category}</p>
                        <ul className="text-sm space-y-1">
                          {roles.map(roleName => {
                            const perm = permissions.find((p: any) => p.permission_name === roleName);
                            return (
                              <li key={roleName} className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                                  perm?.status === 'granted' ? 'bg-green-500' :
                                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                                )} />
                                <span className="text-xs truncate">{roleName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || tenant.connection_status === 'disconnected'}>
                  {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Testar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="w-3 h-3 mr-1" />Editar
                </Button>
                <Button variant="outline" size="sm" onClick={handleRevalidatePermissions} disabled={revalidating || tenant.connection_status === 'disconnected'}>
                  {revalidating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
                  Revalidar Permissões
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
              <Button onClick={handleAnalyze} disabled={!canAnalyze || analyzing} className="gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {analyzing ? 'Analisando...' : 'Analisar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      {tenant && (
        <TenantEditDialog
          tenant={{
            ...tenant,
            client: (tenant as any).clients || { id: tenant.client_id, name: '—' },
          } as any}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleSave}
        />
      )}

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
