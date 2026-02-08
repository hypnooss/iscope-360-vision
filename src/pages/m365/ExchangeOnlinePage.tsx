import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useExchangeOnlineInsights } from '@/hooks/useExchangeOnlineInsights';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExoInsightSummaryCards } from '@/components/m365/exchange/ExoInsightSummaryCards';
import { M365CategorySection } from '@/components/m365/posture/M365CategorySection';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { 
  M365RiskCategory, 
  CATEGORY_LABELS,
  M365Insight 
} from '@/types/m365Insights';
import { 
  Mail, 
  RefreshCw, 
  AlertTriangle,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Categories relevant to Exchange Online product
 * Used to filter and group insights for the Exchange Online page
 */
const EXCHANGE_CATEGORIES: M365RiskCategory[] = [
  'email_exchange',      // Fluxo de email, DKIM, regras
  'threats_activity',    // Anti-phish, Safe Links, etc.
  'pim_governance',      // Remote domains, OWA policies
];

export default function ExchangeOnlinePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const [hasInitialized, setHasInitialized] = useState(false);

  const { 
    insights, 
    summary, 
    analyzedAt,
    loading: insightsLoading, 
    error,
    errorCode,
    triggerAnalysis,
  } = useExchangeOnlineInsights({
    tenantRecordId: selectedTenantId,
  });

  // Auth redirects
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

  // Mark as initialized when tenant is selected (auto-fetch happens in hook)
  useEffect(() => {
    if (selectedTenantId && !tenantsLoading) {
      setHasInitialized(true);
    }
  }, [selectedTenantId, tenantsLoading]);

  if (authLoading) return null;

  // Map ExchangeInsight to M365Insight for component compatibility
  const m365Insights: M365Insight[] = insights.map(insight => ({
    id: insight.id,
    code: insight.id,
    category: insight.category,
    product: 'exchange_online',
    severity: insight.severity,
    titulo: insight.name,
    descricaoExecutiva: insight.description,
    riscoTecnico: insight.details || '',
    impactoNegocio: insight.recommendation || '',
    scoreImpacto: 5,
    status: insight.status === 'pass' ? 'pass' : insight.status === 'fail' ? 'fail' : 'warning',
    evidencias: [],
    affectedEntities: (insight.affectedEntities || []).map((e, idx) => ({
      id: `${insight.id}-${idx}`,
      displayName: e.name,
      details: { type: e.type, info: e.details },
    })),
    affectedCount: insight.affectedEntities?.length || 0,
    endpointUsado: '',
    source: 'exchange_powershell',
    remediacao: {
      productAfetado: 'exchange_online',
      portalUrl: 'https://admin.exchange.microsoft.com',
      caminhoPortal: [],
      passosDetalhados: insight.recommendation ? [insight.recommendation] : [],
      referenciaDocumentacao: '',
    },
    detectedAt: insight.detectedAt,
  }));

  // Group insights by category
  const insightsByCategory: Record<M365RiskCategory, M365Insight[]> = {
    identities: [],
    auth_access: [],
    admin_privileges: [],
    apps_integrations: [],
    email_exchange: m365Insights.filter(i => i.category === 'email_exchange'),
    threats_activity: m365Insights.filter(i => i.category === 'threats_activity'),
    intune_devices: [],
    pim_governance: m365Insights.filter(i => i.category === 'pim_governance'),
    sharepoint_onedrive: [],
    teams_collaboration: [],
    defender_security: [],
  };

  // No tenant connected
  if (!tenantsLoading && tenants.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb items={[
            { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
            { label: 'Exchange Online' },
          ]} />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Exchange Online</h1>
              <p className="text-muted-foreground">
                Análise de riscos e configurações do serviço de e-mail
              </p>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar os insights do Exchange Online, primeiro conecte um tenant Microsoft 365.
              </p>
              <Button asChild className="gap-2">
                <Link to="/scope-m365/tenant-connection">
                  <LinkIcon className="w-4 h-4" />
                  Conectar Tenant
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Exchange Online' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Exchange Online</h1>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Análise de riscos e configurações do serviço de e-mail
            </p>
          </div>
          <Button 
            className="gap-2"
            onClick={triggerAnalysis}
            disabled={insightsLoading}
          >
            <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
            {insightsLoading ? 'Analisando...' : 'Reanalisar'}
          </Button>
        </div>

        {/* Tenant Selector */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <TenantSelector
                tenants={tenants}
                selectedId={selectedTenantId}
                onSelect={selectTenant}
                loading={tenantsLoading}
              />
              <div className="flex items-center gap-3">
                {analyzedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      Analisado em {format(new Date(analyzedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  Conectado
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="mb-8">
          <ExoInsightSummaryCards summary={summary} loading={insightsLoading} />
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{error}</h3>
              {errorCode === 'PERMISSION_ERROR' && (
                <p className="text-sm text-muted-foreground">
                  São necessárias as permissões MailboxSettings.Read e Mail.Read para analisar o Exchange Online.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {insightsLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Insights by Category - using unified M365CategorySection */}
        {!insightsLoading && !error && m365Insights.length > 0 && (
          <div className="space-y-6">
            {EXCHANGE_CATEGORIES.map((category, index) => (
              <M365CategorySection 
                key={category}
                category={category} 
                label={CATEGORY_LABELS[category]}
                insights={insightsByCategory[category]} 
                index={index}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!insightsLoading && !error && m365Insights.length === 0 && hasInitialized && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insight detectado</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Não foram encontrados indicadores de risco no Exchange Online. 
                Isso pode significar que o ambiente está seguro ou que mais dados são necessários.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
