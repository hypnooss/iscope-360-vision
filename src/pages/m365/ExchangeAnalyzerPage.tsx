import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useExchangeDashboard, type ExchangeDashboardData } from '@/hooks/useExchangeDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExchangeAnalyzerStatsCards } from '@/components/m365/exchange/ExchangeAnalyzerStatsCards';
import { ExchangeAnalyzerCategoryGrid } from '@/components/m365/exchange/ExchangeAnalyzerCategoryGrid';
import { ExchangeAnalyzerCategorySheet } from '@/components/m365/exchange/ExchangeAnalyzerCategorySheet';
import { ExchangeSecurityInsightCards } from '@/components/m365/exchange/ExchangeSecurityInsightCards';
import { ExchangeThreatProtectionSection } from '@/components/m365/exchange/ExchangeThreatProtectionSection';
import { useLatestM365AnalyzerSnapshot } from '@/hooks/useM365AnalyzerData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { M365RiskCategory } from '@/types/m365Insights';
import type { M365AnalyzerInsight, M365AnalyzerCategory } from '@/types/m365AnalyzerInsights';
import {
  Building2, Play, Loader2, Clock, Info, AlertTriangle, LinkIcon, Mail, Settings,
} from 'lucide-react';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Exchange-relevant operational categories ────────────────────────────────
const EXCHANGE_OPERATIONAL_CATEGORIES: M365AnalyzerCategory[] = [
  'threat_protection',
  'phishing_threats',
  'behavioral_baseline',
  'suspicious_rules',
  'exfiltration',
  'exchange_health',
];

// ─── Filter out configurational/compliance insights ──────────────────────────
const CONFIG_KEYWORDS = [
  'desabilitado', 'disabled', 'configuração', 'configuracao', 'policy',
  'habilitado', 'enabled', 'anti-spam', 'intelligence',
];

function isConfigurationalInsight(insight: M365AnalyzerInsight): boolean {
  const name = insight.name.toLowerCase();
  if (CONFIG_KEYWORDS.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}

export default function ExchangeAnalyzerPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // Workspace selector (super roles only)
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

  // Tenant selector
  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector(
    isSuperRole ? selectedWorkspaceId : undefined
  );

  // Data hooks
  const { data: dashboardData, loading: dashboardLoading, refresh: refreshDashboard, refreshing: dashboardRefreshing } = useExchangeDashboard({ tenantRecordId: selectedTenantId });
  const { data: analyzerSnapshot, isLoading: analyzerLoading } = useLatestM365AnalyzerSnapshot(selectedTenantId || undefined);

  const [triggering, setTriggering] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  // Category sheet state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<M365RiskCategory | null>(null);

  // ─── Extract operational Exchange insights from analyzer snapshot ───────────
  const exchangeInsights: M365AnalyzerInsight[] = (analyzerSnapshot?.insights ?? [])
    .filter(i => EXCHANGE_OPERATIONAL_CATEGORIES.includes(i.category as M365AnalyzerCategory))
    .filter(i => !isConfigurationalInsight(i));

  const analyzedAt = analyzerSnapshot?.created_at;

  const handleTriggerAnalysis = async () => {
    if (!selectedTenantId) return;
    setTriggering(true);
    try {
      const [analyzerResult, dashboardResult] = await Promise.all([
        supabase.functions.invoke('trigger-m365-analyzer', {
          body: { tenant_record_id: selectedTenantId },
        }),
        supabase.functions.invoke('exchange-dashboard', {
          body: { tenant_record_id: selectedTenantId },
        }),
      ]);
      if (analyzerResult.error) throw analyzerResult.error;
      // Recarregar cache local com os novos dados do exchange-dashboard
      refreshDashboard();
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasModuleAccess('scope_m365')) navigate('/modules');
  }, [user, authLoading, hasModuleAccess, navigate]);

  if (authLoading) return null;

  const loading = dashboardLoading || analyzerLoading;


  const noTenants = !tenantsLoading && tenants.length === 0;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365' }, { label: 'Exchange Analyzer' }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exchange Analyzer</h1>
            <p className="text-muted-foreground">Análise de segurança e postura do Exchange Online</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && !isPreviewMode && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces?.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedTenantId ?? ''} onValueChange={selectTenant}>
              <SelectTrigger className="w-[220px]">
                <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecionar tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.displayName} {t.domain && `(${t.domain})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleTriggerAnalysis} disabled={triggering || !selectedTenantId || loading}>
              {triggering || loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando...</>
                : <><Play className="w-4 h-4 mr-2" />Executar Análise</>}
            </Button>
            <Button variant="outline" size="icon" title="Configurar agendamento"
              disabled={!selectedTenantId} onClick={() => setScheduleDialogOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress card */}
        {triggering && (
          <Card className="glass-card border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Análise em andamento...</span>
              </div>
              <Progress value={40} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Last analysis info */}
        {analyzedAt && (
          <div className="flex items-center gap-3 flex-wrap mb-8">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última coleta</span>
            <Badge variant="outline" className="text-xs">
              {format(new Date(analyzedAt), "dd/MM/yyyy, HH:mm", { locale: ptBR })}
            </Badge>
          </div>
        )}

        {/* Empty state: dashboard cache not populated */}
        {selectedTenantId && !dashboardLoading && !dashboardData && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-10 text-center">
              <Mail className="w-10 h-10 text-warning mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">Dados do Exchange não sincronizados</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                Este tenant ainda não possui dados coletados do Exchange Online. Clique abaixo para executar a primeira coleta.
              </p>
              <Button onClick={refreshDashboard} disabled={dashboardRefreshing} className="gap-2">
                {dashboardRefreshing
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Coletando...</>
                  : <><Play className="w-4 h-4" />Atualizar Dashboard</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {selectedTenantId && !loading && dashboardData && (
          <div className="mb-8">
            <ExchangeAnalyzerStatsCards data={dashboardData} />
          </div>
        )}

        {/* Category Grid */}
        {selectedTenantId && !loading && dashboardData && (
          <ExchangeAnalyzerCategoryGrid data={dashboardData} />
        )}

        {/* Threat Protection */}
        {selectedTenantId && !loading && dashboardData && (
          <ExchangeThreatProtectionSection
            data={analyzerSnapshot?.metrics?.threatProtection ?? null}
            loading={analyzerLoading}
          />
        )}

        {/* Security Insights (operational only) */}
        {selectedTenantId && !analyzerLoading && dashboardData && (
          <ExchangeSecurityInsightCards insights={exchangeInsights} loading={analyzerLoading} />
        )}

        {/* No tenant connected */}
        {noTenants && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar o Exchange Analyzer, primeiro conecte um tenant Microsoft 365.
              </p>
              <Button asChild className="gap-2">
                <Link to="/environment/new/m365"><LinkIcon className="w-4 h-4" />Conectar Tenant</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty states */}
        {!noTenants && !selectedTenantId && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Selecione um tenant para visualizar a análise do Exchange.</AlertDescription>
          </Alert>
        )}

        {selectedTenantId && !loading && exchangeInsights.length === 0 && !analyzerSnapshot && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Nenhuma análise encontrada. Clique em "Executar Análise" para começar.</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Category Sheet */}
      <ExchangeAnalyzerCategorySheet
        open={categorySheetOpen}
        onOpenChange={setCategorySheetOpen}
        category={selectedCategory}
        insights={[]}
      />
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        entityId={selectedTenantId ?? ''}
        table="m365_analyzer_schedules"
        entityColumn="tenant_record_id"
        title="Agendamento do Exchange Analyzer"
        description="Configure a frequência de execução automática da análise do Exchange Online."
        recommendation="Recomendamos agendar a execução 1 vez ao dia para manter a postura atualizada."
      />
    </AppLayout>
  );
}
