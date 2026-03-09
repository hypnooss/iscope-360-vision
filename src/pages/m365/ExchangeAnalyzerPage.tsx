import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useExchangeDashboard, type ExchangeDashboardData } from '@/hooks/useExchangeDashboard';
import { useExchangeOnlineInsights } from '@/hooks/useExchangeOnlineInsights';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExchangeAnalyzerStatsCards } from '@/components/m365/exchange/ExchangeAnalyzerStatsCards';
import { ExchangeAnalyzerCategoryGrid } from '@/components/m365/exchange/ExchangeAnalyzerCategoryGrid';
import { ExchangeAnalyzerCategorySheet } from '@/components/m365/exchange/ExchangeAnalyzerCategorySheet';
import { ExchangeSecurityInsightCards } from '@/components/m365/exchange/ExchangeSecurityInsightCards';
import { EmailSecurityPostureCard } from '@/components/m365/exchange/EmailSecurityPostureCard';
import { EmailTrafficCard } from '@/components/m365/exchange/EmailTrafficCard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { M365RiskCategory } from '@/types/m365Insights';
import {
  Building2, Play, Loader2, Clock, Info, AlertTriangle, LinkIcon, Globe, Mail,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { data: dashboardData, loading: dashboardLoading } = useExchangeDashboard({ tenantRecordId: selectedTenantId });
  const {
    insights,
    summary,
    analyzedAt,
    loading: insightsLoading,
    error: insightsError,
    errorCode,
    triggerAnalysis,
  } = useExchangeOnlineInsights({ tenantRecordId: selectedTenantId });

  const [triggering, setTriggering] = useState(false);

  // Category sheet state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<M365RiskCategory | null>(null);

  const handleTriggerAnalysis = async () => {
    setTriggering(true);
    try {
      await triggerAnalysis();
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

  const loading = dashboardLoading || insightsLoading;

  const DEFAULT_DASHBOARD_DATA: ExchangeDashboardData = {
    mailboxes: { total: 0, overQuota: 0, forwardingEnabled: 0, autoReplyExternal: 0, newLast30d: 0, notLoggedIn30d: 0 },
    traffic: { sent: 0, received: 0 },
    security: { maliciousInbound: 0, phishing: 0, malware: 0, spam: 0 },
    analyzedAt: '',
  };
  const effectiveDashboard = dashboardData ?? DEFAULT_DASHBOARD_DATA;

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
          <div className="flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última análise:</span>
            <Badge variant="outline" className="text-xs">
              {format(new Date(analyzedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </Badge>
          </div>
        )}

        {/* Stats Cards */}
        {selectedTenantId && !loading && (
          <div className="mb-2">
            <ExchangeAnalyzerStatsCards data={effectiveDashboard} />
          </div>
        )}

        {/* Category Grid */}
        {selectedTenantId && !loading && (
          <ExchangeAnalyzerCategoryGrid data={effectiveDashboard} />
        )}

        {/* Email Security Posture & Traffic */}
        {selectedTenantId && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmailSecurityPostureCard data={effectiveDashboard} />
            <EmailTrafficCard data={effectiveDashboard} />
          </div>
        )}

        {/* Security Insights */}
        {insights.length > 0 && !insightsLoading && (
          <ExchangeSecurityInsightCards insights={insights} />
        )}

        {/* Empty states */}
        {!selectedTenantId && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Selecione um tenant para visualizar a análise do Exchange.</AlertDescription>
          </Alert>
        )}

        {selectedTenantId && !loading && insights.length === 0 && errorCode === 'NO_ANALYSIS' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Nenhuma análise encontrada. Clique em "Executar Análise" para começar.</AlertDescription>
          </Alert>
        )}

        {insightsError && errorCode !== 'NO_ANALYSIS' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{insightsError}</h3>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Sheet */}
      <ExchangeAnalyzerCategorySheet
        open={categorySheetOpen}
        onOpenChange={setCategorySheetOpen}
        category={selectedCategory}
        insights={insights}
      />
    </AppLayout>
  );
}
