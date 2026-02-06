import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { usePreviewGuard } from '@/hooks/usePreviewGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Play, Loader2, Clock, CheckCircle, AlertTriangle, Building } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tenant {
  id: string;
  tenant_id: string;
  tenant_domain: string | null;
  display_name: string | null;
  client_id: string;
  connection_status: string;
  client?: { name: string };
}

interface LastAnalysis {
  id: string;
  score: number | null;
  status: string;
  created_at: string;
}

export default function M365AnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const { isBlocked, showBlockedMessage } = usePreviewGuard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  useEffect(() => {
    if (authLoading || moduleLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  // Fetch tenants
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['m365-tenants-for-analysis', isPreviewMode, previewTarget?.workspaces],
    queryFn: async () => {
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      let query = supabase
        .from('m365_tenants')
        .select('id, tenant_id, tenant_domain, display_name, client_id, connection_status, clients:client_id(name)')
        .eq('connection_status', 'connected')
        .order('display_name');

      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((t: any) => ({
        ...t,
        client: t.clients,
      })) as Tenant[];
    },
    enabled: !!user,
  });

  // Auto-select first tenant
  useEffect(() => {
    if (tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [tenants, selectedTenantId]);

  // Fetch last analysis for selected tenant
  const { data: lastAnalysis } = useQuery({
    queryKey: ['m365-last-analysis', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;

      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('id, score, status, created_at')
        .eq('tenant_record_id', selectedTenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LastAnalysis | null;
    },
    enabled: !!selectedTenantId,
  });

  // Trigger analysis mutation
  const triggerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('trigger-m365-posture-analysis', {
        body: { tenant_record_id: selectedTenantId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to start analysis');
      return data;
    },
    onSuccess: (data) => {
      toast.success('Análise iniciada', {
        description: 'Acompanhe o progresso na página de Execuções.',
        action: {
          label: 'Ver Execuções',
          onClick: () => navigate('/scope-m365/executions'),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['m365-last-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['m365-posture-history'] });
    },
    onError: (error: any) => {
      console.error('Failed to trigger analysis:', error);
      if (error.message?.includes('already in progress')) {
        toast.warning('Análise já em andamento', {
          description: 'Aguarde a conclusão da análise atual.',
        });
      } else {
        toast.error('Erro ao iniciar análise', {
          description: error.message || 'Tente novamente.',
        });
      }
    },
  });

  const handleStartAnalysis = () => {
    if (isBlocked) {
      showBlockedMessage();
      return;
    }
    if (!selectedTenantId) {
      toast.error('Selecione um tenant');
      return;
    }
    triggerMutation.mutate();
  };

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 90) return 'bg-success/10 text-success';
    if (score >= 70) return 'bg-success/10 text-success';
    if (score >= 50) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/20 text-green-500"><CheckCircle className="w-3 h-3 mr-1" />Concluída</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Executando</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/20 text-red-500"><AlertTriangle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || moduleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Análise' },
        ]} />

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Análise de Postura de Segurança</h1>
          <p className="text-muted-foreground">Inicie uma análise completa do seu tenant Microsoft 365</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Tenant Selection Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Selecionar Tenant
              </CardTitle>
              <CardDescription>
                Escolha o tenant que deseja analisar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum tenant conectado</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/scope-m365/tenant-connection')}
                  >
                    Conectar Tenant
                  </Button>
                </div>
              ) : (
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(tenant => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        <div className="flex flex-col">
                          <span>{tenant.display_name || tenant.tenant_domain || tenant.tenant_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {tenant.client?.name || 'Sem workspace'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedTenant && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tenant ID</span>
                    <span className="text-sm font-mono">{selectedTenant.tenant_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Domínio</span>
                    <span className="text-sm">{selectedTenant.tenant_domain || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Workspace</span>
                    <span className="text-sm">{selectedTenant.client?.name || 'N/A'}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Status Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Status da Análise
              </CardTitle>
              <CardDescription>
                Última análise e ação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastAnalysis ? (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Última análise</span>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(lastAnalysis.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {getStatusBadge(lastAnalysis.status)}
                  </div>
                  {lastAnalysis.score !== null && lastAnalysis.status === 'completed' && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <Badge className={getScoreColor(lastAnalysis.score)}>
                        {lastAnalysis.score >= 70 ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        )}
                        {lastAnalysis.score}%
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data</span>
                    <span className="text-sm">
                      {format(new Date(lastAnalysis.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ) : selectedTenantId ? (
                <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma análise realizada ainda</p>
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Selecione um tenant para ver o status</p>
                </div>
              )}

              <Button
                onClick={handleStartAnalysis}
                disabled={!selectedTenantId || triggerMutation.isPending || lastAnalysis?.status === 'running' || lastAnalysis?.status === 'pending'}
                className="w-full"
                size="lg"
              >
                {triggerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando...
                  </>
                ) : lastAnalysis?.status === 'running' || lastAnalysis?.status === 'pending' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Análise em Andamento
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Análise
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                A análise pode levar alguns minutos. Acompanhe o progresso em "Execuções".
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">O que a análise verifica?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A análise de postura de segurança M365 executa mais de 57 verificações automáticas, incluindo:
                  configurações de MFA, privilégios administrativos, políticas de acesso condicional,
                  aplicações OAuth, configurações do Exchange Online, Intune, SharePoint, Teams e muito mais.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
