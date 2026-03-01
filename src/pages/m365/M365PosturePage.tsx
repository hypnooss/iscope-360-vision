import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { usePreviewGuard } from '@/hooks/usePreviewGuard';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommandCentralLayout, MiniStat, DetailRow } from '@/components/CommandCentral';
import { 
  RefreshCw, 
  AlertTriangle, 
  Lock,
  Clock,
  Play,
  Settings,
} from 'lucide-react';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';
import { TenantSelector } from '@/components/m365/posture';
import { M365CategorySection } from '@/components/m365/posture/M365CategorySection';
import { useM365SecurityPosture } from '@/hooks/useM365SecurityPosture';
import { mapM365Insight, mapM365AgentInsight } from '@/lib/complianceMappers';
import { 
  M365RiskCategory, 
  CATEGORY_LABELS,
} from '@/types/m365Insights';
import { UnifiedComplianceItem } from '@/types/unifiedCompliance';

export default function M365PosturePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { isBlocked, showBlockedMessage } = usePreviewGuard();
  const navigate = useNavigate();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  
  const { tenants, selectedTenantId, selectedTenant, selectTenant, loading: tenantsLoading } = useM365TenantSelector();

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    triggerAnalysis,
    agentInsights,
    agentStatus,
    isAgentPending,
  } = useM365SecurityPosture({ 
    tenantRecordId: selectedTenantId || '' 
  });

  // Auth and module access check
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

  // Fetch latest analysis from history when tenant changes (no auto-trigger)
  // Analysis is now triggered only by user clicking "Atualizar" button

  // Handle refresh with Preview Mode guard - now triggers full analysis
  const handleRefresh = useCallback(async () => {
    if (isBlocked) {
      showBlockedMessage();
      return;
    }
    await triggerAnalysis();
  }, [isBlocked, showBlockedMessage, triggerAnalysis]);

  if (authLoading || tenantsLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Merge Graph insights + Agent insights into unified items grouped by category
  const allUnifiedItems: UnifiedComplianceItem[] = [
    ...(data?.insights?.map(mapM365Insight) || []),
    ...(agentInsights?.map(mapM365AgentInsight) || []),
  ];

  const groupedItems = allUnifiedItems.reduce<Record<string, UnifiedComplianceItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <PageBreadcrumb 
          items={[
            { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
            { label: 'Compliance' }
          ]} 
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">M365 Compliance</h1>
            <p className="text-muted-foreground">Análise consolidada do ambiente Microsoft 365</p>
          </div>
          <div className="flex items-center gap-3">
            <TenantSelector
              tenants={tenants}
              selectedId={selectedTenantId}
              onSelect={selectTenant}
              loading={isLoading}
              disabled={isBlocked}
            />
            <Button onClick={handleRefresh} disabled={isLoading || !selectedTenantId}>
              {isBlocked && <Lock className="w-4 h-4 mr-2" />}
              {isLoading
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analisando...</>
                : <><Play className="w-4 h-4 mr-2" />Executar Análise</>}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Configurar agendamento"
              disabled={!selectedTenantId}
              onClick={() => setScheduleDialogOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Last collection info */}
        {data?.analyzedAt && (
          <div className="flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última coleta:</span>
            <Badge variant="outline" className="text-xs">
              {new Date(data.analyzedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {data?.cached && (
              <Badge variant="secondary" className="text-xs">
                Resultado em cache
              </Badge>
            )}
          </div>
        )}

        {/* Error State */}
        {error && !data && (
          <Card className="glass-card border-destructive/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <p className="font-semibold">Erro na análise</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No tenants state */}
        {tenants.length === 0 && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum tenant disponível
              </h3>
              <p className="text-muted-foreground mb-4">
                {isPreviewMode 
                  ? 'O usuário visualizado não possui tenants M365 conectados.'
                  : 'Conecte um tenant Microsoft 365 para analisar a postura de segurança.'}
              </p>
              {!isPreviewMode && (
                <Button onClick={() => navigate('/environment/new/m365')}>
                  Conectar Tenant
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main content - only show if tenants available */}
        {tenants.length > 0 && (
          <>
            {/* Command Central */}
            <CommandCentralLayout
              title={selectedTenant?.displayName || 'Microsoft 365'}
              score={data?.score ?? 0}
              miniStats={
                <>
                  <MiniStat value={data?.summary?.total ?? 0} label="Total" variant="primary" />
                  <MiniStat value={(data?.summary?.total ?? 0) - (data?.summary?.critical ?? 0) - (data?.summary?.high ?? 0) - (data?.summary?.medium ?? 0) - (data?.summary?.low ?? 0)} label="Aprovadas" variant="success" />
                  <MiniStat value={(data?.summary?.critical ?? 0) + (data?.summary?.high ?? 0) + (data?.summary?.medium ?? 0) + (data?.summary?.low ?? 0)} label="Falhas" variant="destructive" />
                </>
              }
              detailRows={
                <>
                  <DetailRow label="Tenant" value={selectedTenant?.displayName || 'N/A'} />
                  <DetailRow label="Domínio" value={selectedTenant?.domain || 'N/A'} />
                  <DetailRow label="Última Coleta" value={data?.analyzedAt ? new Date(data.analyzedAt).toLocaleString('pt-BR') : 'N/A'} />
                  <DetailRow 
                    label="Agent" 
                    value={agentStatus === 'completed' ? 'Conectado' : agentStatus === 'failed' ? 'Falhou' : isAgentPending ? 'Aguardando' : 'N/A'}
                    indicator={agentStatus === 'completed' ? 'success' : agentStatus === 'failed' ? 'error' : undefined}
                  />
                  {data?.errors && data.errors.length > 0 && (
                    <DetailRow label="Avisos" value={`${data.errors.length} aviso(s) durante coleta`} />
                  )}
                </>
              }
            />

            {/* Verificações por Categoria */}
            {Object.keys(groupedItems).length > 0 && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground mb-4">Verificações por Categoria</h2>
                {(Object.keys(groupedItems) as M365RiskCategory[]).map((category, index) => (
                  <M365CategorySection
                    key={category}
                    category={category}
                    label={CATEGORY_LABELS[category] || category}
                    items={groupedItems[category]}
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && allUnifiedItems.length === 0 && (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nenhum insight disponível
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Clique em "Atualizar" para executar a análise de segurança.
                  </p>
                  <Button onClick={handleRefresh} disabled={isBlocked}>
                    {isBlocked && <Lock className="w-4 h-4 mr-2" />}
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Iniciar Análise
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Schedule Dialog */}
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          entityId={selectedTenantId || ''}
          table="m365_analyzer_schedules"
          entityColumn="tenant_record_id"
          title="Agendamento do Compliance M365"
          description="Configure a frequência de execução automática da análise de compliance para este tenant."
          recommendation="A análise de compliance verifica a conformidade da configuração. Recomendamos agendar a execução 1 vez ao dia."
        />
      </div>
    </AppLayout>
  );
}
