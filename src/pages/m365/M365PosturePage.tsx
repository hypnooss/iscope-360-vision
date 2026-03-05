import { useEffect, useCallback, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { usePreviewGuard } from '@/hooks/usePreviewGuard';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CommandCentralLayout, MiniStat, DetailRow } from '@/components/CommandCentral';
import { 
  RefreshCw, 
  AlertTriangle, 
  Lock,
  Clock,
  Play,
  Settings,
  Loader2,
  Building2,
  ChevronDown,
  FileDown,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';
import { TenantSelector } from '@/components/m365/posture';
import { M365CategorySection } from '@/components/m365/posture/M365CategorySection';
import { useM365SecurityPosture, M365_POSTURE_QUERY_KEY } from '@/hooks/useM365SecurityPosture';
import { mapM365Insight, mapM365AgentInsight } from '@/lib/complianceMappers';
import { useCategoryConfigs } from '@/hooks/useCategoryConfig';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { M365PosturePDF } from '@/components/pdf/M365PosturePDF';
import type { CorrectionGuideData } from '@/components/pdf/ExternalDomainPDF';
import { 
  M365RiskCategory, 
  CATEGORY_LABELS,
} from '@/types/m365Insights';
import { UnifiedComplianceItem } from '@/types/unifiedCompliance';

export default function M365PosturePage() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole } = useEffectiveAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { isBlocked, showBlockedMessage } = usePreviewGuard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const hasLoadedOnce = useRef(false);
  const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // ── Workspace selector ──
  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);
  const { data: categoryConfigs } = useCategoryConfigs('5d1a7095-2d7b-4541-873d-4b03c3d6122f');

  const { tenants, selectedTenantId, selectedTenant, selectTenant, loading: tenantsLoading } = useM365TenantSelector(
    isSuperRole ? selectedWorkspaceId : undefined
  );

  // Detect in-progress analysis on mount
  const { data: activeAnalysis } = useQuery({
    queryKey: ['m365-active-analysis', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;
      const { data } = await supabase
        .from('m365_posture_history')
        .select('id, status, created_at')
        .eq('tenant_record_id', selectedTenantId)
        .in('status', ['pending', 'partial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedTenantId && !activeAnalysisId,
  });

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

  // Track if data has been loaded at least once (to skip gauge animation on cached renders)
  useEffect(() => {
    if (data && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
    }
  }, [data]);

  // Poll for analysis status when activeAnalysisId is set
  const { data: analysisRecord } = useQuery({
    queryKey: ['m365-posture-status', activeAnalysisId],
    queryFn: async () => {
      if (!activeAnalysisId) return null;
      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('status, agent_status')
        .eq('id', activeAnalysisId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeAnalysisId,
    refetchInterval: 5000,
  });

  // Restore active analysis state on mount
  useEffect(() => {
    if (activeAnalysis && !activeAnalysisId) {
      setActiveAnalysisId(activeAnalysis.id);
      setAnalysisStartedAt(new Date(activeAnalysis.created_at).getTime());
    }
  }, [activeAnalysis, activeAnalysisId]);

  // Reset analysis state when tenant changes
  useEffect(() => {
    setActiveAnalysisId(null);
    setAnalysisStartedAt(null);
    setElapsed(0);
  }, [selectedTenantId]);

  // Handle polling result
  useEffect(() => {
    if (!analysisRecord || !activeAnalysisId) return;
    const status = analysisRecord.status;
    const agentSt = (analysisRecord as any).agent_status ?? '';
    const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled'
      || (status === 'partial' && ['failed', 'timeout', 'completed'].includes(agentSt));
    if (isFinished) {
      if (status === 'cancelled') {
        toast({ title: 'Análise cancelada', description: 'A análise foi cancelada pelo usuário.' });
      }
      setActiveAnalysisId(null);
      setAnalysisStartedAt(null);
      queryClient.invalidateQueries({ queryKey: [M365_POSTURE_QUERY_KEY, selectedTenantId] });
    }
  }, [analysisRecord, activeAnalysisId, queryClient, selectedTenantId]);

  // Elapsed timer + 10-minute safety timeout
  useEffect(() => {
    if (!analysisStartedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - analysisStartedAt) / 1000);
      setElapsed(secs);
      if (secs > 600) {
        setActiveAnalysisId(null);
        setAnalysisStartedAt(null);
        toast({ title: 'Timeout', description: 'A análise não respondeu em 10 minutos. Verifique o status manualmente.', variant: 'destructive' });
        queryClient.invalidateQueries({ queryKey: [M365_POSTURE_QUERY_KEY, selectedTenantId] });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [analysisStartedAt, queryClient, selectedTenantId]);

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

  // Handle refresh with Preview Mode guard - triggers full analysis
  const handleRefresh = useCallback(async () => {
    if (isBlocked) {
      showBlockedMessage();
      return;
    }
    const result = await triggerAnalysis();
    if (result.success && result.analysisId) {
      setActiveAnalysisId(result.analysisId);
      setAnalysisStartedAt(Date.now());
    }
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

  // Compute actual counts from unified items (not from summary subtraction)
  const passCount = allUnifiedItems.filter(i => i.status === 'pass').length;
  const failCount = allUnifiedItems.filter(i => i.status === 'fail').length;

  const groupedItems = allUnifiedItems.reduce<Record<string, UnifiedComplianceItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Sort categories by template display_order
  const sortedCategories = (Object.keys(groupedItems) as M365RiskCategory[]).sort((a, b) => {
    const aOrder = categoryConfigs?.find(c => c.name === a)?.display_order ?? 999;
    const bOrder = categoryConfigs?.find(c => c.name === b)?.display_order ?? 999;
    return aOrder - bOrder;
  });

  const isAnalysisRunning = !!activeAnalysisId;
  const analysisStatus = analysisRecord?.status ?? 'pending';
  const progressValue = analysisStatus === 'partial' ? 60 : 30;

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
            {isSuperRole && allWorkspaces && (
              <Select value={selectedWorkspaceId || ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <TenantSelector
              tenants={tenants}
              selectedId={selectedTenantId}
              onSelect={selectTenant}
              loading={isLoading}
              disabled={isBlocked}
            />
            <Button onClick={handleRefresh} disabled={isLoading || isAnalysisRunning || !selectedTenantId}>
              {isBlocked && <Lock className="w-4 h-4 mr-2" />}
              {isLoading || isAnalysisRunning
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

        {/* Progress Bar */}
        {isAnalysisRunning && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Análise em andamento...</p>
                <p className="text-xs text-muted-foreground">
                  {analysisStatus === 'partial' 
                    ? 'Graph API concluída, aguardando Agent PowerShell...' 
                    : 'Coletando dados via Graph API...'}
                  {elapsed > 0 && ` · ${elapsed}s`}
                </p>
              </div>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

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
              skipGaugeAnimation={hasLoadedOnce.current}
              miniStats={
                <>
                  <MiniStat value={allUnifiedItems.length} label="Total" variant="primary" />
                  <MiniStat value={passCount} label="Aprovadas" variant="success" />
                  <MiniStat value={failCount} label="Falhas" variant="destructive" />
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
                {sortedCategories.map((category, index) => (
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
            {!isLoading && !isAnalysisRunning && !error && allUnifiedItems.length === 0 && (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nenhum insight disponível
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Clique em "Executar Análise" para iniciar a análise de segurança.
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
