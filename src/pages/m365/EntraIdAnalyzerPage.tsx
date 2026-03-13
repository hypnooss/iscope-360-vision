import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useEntraIdDashboard } from '@/hooks/useEntraIdDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EntraIdAnalyzerStatsCards } from '@/components/m365/entra-id/EntraIdAnalyzerStatsCards';
import { EntraIdAnalyzerCategoryGrid } from '@/components/m365/entra-id/EntraIdAnalyzerCategoryGrid';
import { EntraIdCategorySheet } from '@/components/m365/entra-id/EntraIdCategorySheet';
import type { EntraIdOperationalCategory } from '@/components/m365/entra-id/EntraIdAnalyzerCategoryGrid';
import { EntraIdSecurityInsightCards } from '@/components/m365/entra-id/EntraIdSecurityInsightCards';
import { EntraIdLoginMap } from '@/components/m365/entra-id/EntraIdLoginMap';
import { useLatestM365AnalyzerSnapshot } from '@/hooks/useM365AnalyzerData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import type { M365AnalyzerInsight, M365AnalyzerCategory } from '@/types/m365AnalyzerInsights';
import { toast } from 'sonner';
import {
  Building2, Play, Loader2, Clock, Info, AlertTriangle, LinkIcon, Shield, Settings,
} from 'lucide-react';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';
import { formatDateTimeBR, formatShortDateTimeBR } from '@/lib/dateUtils';
import { DataSourceLegend } from '@/components/m365/shared';

// ─── Identity-relevant operational categories ────────────────────────────────
const ENTRA_OPERATIONAL_CATEGORIES: M365AnalyzerCategory[] = [
  'security_risk',
  'identity_access',
  'conditional_access',
  'account_compromise',
  'operational_risks',
  'audit_compliance',
];

// ─── Filter out configurational/compliance insights ──────────────────────────
const CONFIG_KEYWORDS = [
  'desabilitado', 'disabled', 'configuração', 'configuracao', 'policy',
  'habilitado', 'enabled',
];

function isConfigurationalInsight(insight: M365AnalyzerInsight): boolean {
  const name = insight.name.toLowerCase();
  if (CONFIG_KEYWORDS.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}

export default function EntraIdAnalyzerPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

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

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector(
    isSuperRole ? selectedWorkspaceId : undefined
  );

  const { data: dashboardData, loading: dashboardLoading, refresh: refreshDashboard, refreshing: dashboardRefreshing } = useEntraIdDashboard({ tenantRecordId: selectedTenantId });
  const { data: analyzerSnapshot, isLoading: analyzerLoading } = useLatestM365AnalyzerSnapshot(selectedTenantId || undefined);

  const [triggering, setTriggering] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const [selectedOpCategory, setSelectedOpCategory] = useState<EntraIdOperationalCategory | null>(null);
  const [opCategorySheetOpen, setOpCategorySheetOpen] = useState(false);

  // ─── Extract identity insights from analyzer snapshot ───────────
  const entraInsights: M365AnalyzerInsight[] = (analyzerSnapshot?.insights ?? [])
    .filter(i => ENTRA_OPERATIONAL_CATEGORIES.includes(i.category as M365AnalyzerCategory))
    .filter(i => !isConfigurationalInsight(i));

  const analyzedAt = analyzerSnapshot?.created_at;

  const handleTriggerAnalysis = async () => {
    if (!selectedTenantId) return;
    setTriggering(true);
    try {
      const [analyzerResult] = await Promise.all([
        supabase.functions.invoke('trigger-m365-analyzer', {
          body: { tenant_record_id: selectedTenantId },
        }),
        supabase.functions.invoke('entra-id-dashboard', {
          body: { tenant_record_id: selectedTenantId },
        }),
        supabase.functions.invoke('exchange-dashboard', {
          body: { tenant_record_id: selectedTenantId },
        }),
        supabase.functions.invoke('collaboration-dashboard', {
          body: { tenant_record_id: selectedTenantId },
        }),
      ]);
      if (analyzerResult.error) throw analyzerResult.error;
      if (analyzerResult.data && !analyzerResult.data.success) {
        const code = analyzerResult.data.code;
        const msg = analyzerResult.data.error || 'Erro ao disparar análise';
        toast.error(
          code === 'ALREADY_RUNNING' ? 'Análise já em andamento' :
          code === 'AGENT_OFFLINE'   ? 'Agent offline — verifique a conectividade' : msg,
          { description: analyzerResult.data.message || msg }
        );
        setTriggering(false);
        return;
      }
      toast.success('Análise iniciada', { description: 'A coleta de dados será processada em breve.' });
      refreshDashboard();
    } catch (e: any) {
      toast.error('Erro ao disparar análise', { description: e.message });
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

  // ─── Fallback: derive dashboard KPIs from analyzer snapshot metrics ─────
  const effectiveDashboardData = dashboardData ?? (() => {
    const m = analyzerSnapshot?.metrics;
    if (!m) return null;
    return {
      users: {
        total: (m.identity?.newUsers ?? 0) + (m.identity?.disabledUsers ?? 0) + (m.identity?.noMfaUsers ?? 0),
        signInEnabled: 0,
        disabled: m.identity?.disabledUsers ?? 0,
        guests: 0,
        onPremSynced: 0,
      },
      admins: { total: 0, globalAdmins: 0 },
      mfa: {
        total: 0,
        enabled: 0,
        disabled: m.identity?.noMfaUsers ?? 0,
      },
      risks: {
        riskyUsers: m.securityRisk?.riskyUsers ?? 0,
        atRisk: m.securityRisk?.highRiskSignIns ?? 0,
        compromised: m.securityRisk?.blockedAccounts ?? 0,
      },
      loginActivity: {
        total: 0,
        success: 0,
        failed: m.securityRisk?.mfaFailures ?? 0,
        mfaRequired: 0,
        blocked: m.securityRisk?.blockedAccounts ?? 0,
      },
      userChanges: {
        updated: 0,
        new: m.identity?.newUsers ?? 0,
        enabled: 0,
        disabled: m.identity?.disabledUsers ?? 0,
        deleted: 0,
      },
      passwordActivity: { resets: 0, forcedChanges: 0, selfService: 0 },
      loginCountriesSuccess: [],
      loginCountriesFailed: [],
      analyzedAt: analyzerSnapshot?.created_at ?? '',
    };
  })();

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-10">
        <PageBreadcrumb items={[{ label: 'Microsoft 365' }, { label: 'Entra ID Analyzer' }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entra ID Analyzer</h1>
            <p className="text-muted-foreground">Análise de segurança e postura de identidade</p>
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
                <Shield className="w-4 h-4 mr-2 text-muted-foreground" />
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
            <span className="text-sm text-muted-foreground">Última coleta:</span>
            <Badge variant="outline" className="text-xs">
              {formatDateTimeBR(analyzedAt)}
            </Badge>
            {analyzerSnapshot?.period_start && analyzerSnapshot?.period_end && (
              <>
                <span className="text-sm text-muted-foreground">Período agregado:</span>
                <Badge variant="outline" className="text-xs">
                  {formatShortDateTimeBR(analyzerSnapshot.period_start)}
                  {' → '}
                  {formatShortDateTimeBR(analyzerSnapshot.period_end)}
                </Badge>
              </>
            )}
            {(analyzerSnapshot as any)?.snapshotCount && (
              <Badge variant="secondary" className="text-xs">
                {(analyzerSnapshot as any).snapshotCount} coletas
              </Badge>
            )}
            <DataSourceLegend />
          </div>
        )}

        {/* Empty state: no dashboard cache AND no analyzer snapshot */}
        {selectedTenantId && !dashboardLoading && !analyzerLoading && !effectiveDashboardData && !analyzerSnapshot && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-10 text-center">
              <Shield className="w-10 h-10 text-warning mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">Nenhuma análise do Entra ID encontrada</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                Não existem análises efetuadas até o momento. Clique abaixo para executar a primeira análise de segurança do Entra ID.
              </p>
              <Button onClick={handleTriggerAnalysis} disabled={triggering || loading || !selectedTenantId} className="gap-2">
                {triggering || loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</>
                  : <><Play className="w-4 h-4" />Executar Análise</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {selectedTenantId && !loading && effectiveDashboardData && (
          <div className="mb-8">
            <EntraIdAnalyzerStatsCards data={effectiveDashboardData} />
          </div>
        )}

        {/* Category Grid */}
        {selectedTenantId && !loading && effectiveDashboardData && (
          <div className="mb-8">
            <EntraIdAnalyzerCategoryGrid
              data={effectiveDashboardData}
              onCategoryClick={(cat) => {
                setSelectedOpCategory(cat);
                setOpCategorySheetOpen(true);
              }}
            />
          </div>
        )}

        {/* Login Origin Map */}
        {selectedTenantId && !loading && dashboardData && (
          <div className="mb-8">
            <EntraIdLoginMap
              loginCountriesSuccess={dashboardData.loginCountriesSuccess}
              loginCountriesFailed={dashboardData.loginCountriesFailed}
            />
          </div>
        )}

        {/* Security Insights (operational only) — shown independently of dashboard cache */}
        {selectedTenantId && !analyzerLoading && entraInsights.length > 0 && (
          <EntraIdSecurityInsightCards insights={entraInsights} loading={analyzerLoading} />
        )}

        {/* No tenant connected */}
        {noTenants && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar o Entra ID Analyzer, primeiro conecte um tenant Microsoft 365.
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
            <AlertDescription>Selecione um tenant para visualizar a análise do Entra ID.</AlertDescription>
          </Alert>
        )}

      </div>

      <EntraIdCategorySheet
        open={opCategorySheetOpen}
        onOpenChange={setOpCategorySheetOpen}
        category={selectedOpCategory}
        dashboardData={dashboardData}
      />
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        entityId={selectedTenantId ?? ''}
        table="m365_analyzer_schedules"
        entityColumn="tenant_record_id"
        title="Agendamento do Entra ID Analyzer"
        description="Configure a frequência de execução automática da análise do Entra ID."
        recommendation="Recomendamos agendar a execução 1 vez ao dia para manter a postura atualizada."
      />
    </AppLayout>
  );
}
