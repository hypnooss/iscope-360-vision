import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useEntraIdSecurityInsights } from '@/hooks/useEntraIdSecurityInsights';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightSummaryCards } from '@/components/m365/insights/InsightSummaryCards';
import { InsightCategorySection } from '@/components/m365/insights/InsightCategorySection';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { 
  Shield, 
  RefreshCw, 
  AlertTriangle,
  Link as LinkIcon,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toBRT } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InsightCategory } from '@/types/securityInsights';

export default function EntraIdSecurityInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const [hasInitialized, setHasInitialized] = useState(false);

  const { 
    insights, 
    summary, 
    analyzedPeriod,
    loading: insightsLoading, 
    error,
    errorCode,
    refresh,
    triggerAnalysis,
  } = useEntraIdSecurityInsights({
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

  // Group insights by category
  const insightsByCategory: Record<InsightCategory, typeof insights> = {
    identity_security: insights.filter(i => i.category === 'identity_security'),
    behavior_risk: insights.filter(i => i.category === 'behavior_risk'),
    governance: insights.filter(i => i.category === 'governance'),
  };

  // No tenant connected
  if (!tenantsLoading && tenants.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb items={[
            { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
            { label: 'Entra ID', href: '/scope-m365/entra-id' },
            { label: 'Insights de Segurança' },
          ]} />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Insights de Segurança</h1>
              <p className="text-muted-foreground">
                Análise consolidada de riscos e indicadores de segurança
              </p>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar os insights de segurança, primeiro conecte um tenant Microsoft 365.
              </p>
              <Button asChild className="gap-2">
                <Link to="/environment/new/m365">
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
          { label: 'Entra ID', href: '/scope-m365/entra-id' },
          { label: 'Insights de Segurança' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Insights de Segurança</h1>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Análise consolidada de riscos e indicadores de segurança do Entra ID
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
                {analyzedPeriod && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {format(toBRT(new Date(analyzedPeriod.from)), "dd MMM", { locale: ptBR })} - {format(toBRT(new Date(analyzedPeriod.to)), "dd MMM yyyy", { locale: ptBR })}
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
          <InsightSummaryCards summary={summary} loading={insightsLoading} />
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{error}</h3>
              {errorCode === 'PREMIUM_LICENSE_REQUIRED' && (
                <p className="text-sm text-muted-foreground">
                  Os insights de segurança requerem uma licença Azure AD Premium (P1 ou P2) no tenant.
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

        {/* Insights by Category */}
        {!insightsLoading && !error && insights.length > 0 && (
          <div className="space-y-6">
            <InsightCategorySection category="identity_security" insights={insightsByCategory.identity_security} defaultOpen={true} />
            <InsightCategorySection category="behavior_risk" insights={insightsByCategory.behavior_risk} defaultOpen={true} />
            <InsightCategorySection category="governance" insights={insightsByCategory.governance} defaultOpen={true} />
          </div>
        )}

        {/* Empty State */}
        {!insightsLoading && !error && insights.length === 0 && hasInitialized && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insight detectado</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Não foram encontrados indicadores de risco no período analisado. 
                Isso pode significar que o ambiente está seguro ou que mais dados são necessários.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
