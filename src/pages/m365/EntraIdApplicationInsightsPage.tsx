import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useTenantConnection } from '@/hooks/useTenantConnection';
import { useEntraIdApplicationInsights } from '@/hooks/useEntraIdApplicationInsights';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AppInsightSummaryCards,
  AppInsightCategorySection,
} from '@/components/m365/applications';
import { 
  Package, 
  RefreshCw, 
  AlertTriangle,
  Link as LinkIcon,
  Sparkles,
  Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppInsightCategory } from '@/types/applicationInsights';

export default function EntraIdApplicationInsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, loading: tenantsLoading, hasConnectedTenant } = useTenantConnection();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Get the first connected tenant
  const connectedTenant = tenants.find(t => 
    t.connection_status === 'connected' || t.connection_status === 'partial'
  );

  const { 
    insights, 
    summary, 
    loading: insightsLoading, 
    error,
    errorCode,
    refresh 
  } = useEntraIdApplicationInsights({
    tenantRecordId: connectedTenant?.id || null,
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

  // Auto-refresh on mount when tenant is available
  useEffect(() => {
    if (connectedTenant && !hasInitialized && !insightsLoading) {
      setHasInitialized(true);
      refresh();
    }
  }, [connectedTenant, hasInitialized, insightsLoading, refresh]);

  if (authLoading) return null;

  // Group insights by category
  const insightsByCategory: Record<AppInsightCategory, typeof insights> = {
    credential_expiration: insights.filter(i => i.category === 'credential_expiration'),
    privileged_permissions: insights.filter(i => i.category === 'privileged_permissions'),
    security_hygiene: insights.filter(i => i.category === 'security_hygiene'),
  };

  // No tenant connected
  if (!tenantsLoading && !hasConnectedTenant) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb items={[
            { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
            { label: 'Entra ID', href: '/scope-m365/entra-id' },
            { label: 'Aplicativos' },
          ]} />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Aplicativos</h1>
              <p className="text-muted-foreground">
                Análise de riscos em App Registrations e Enterprise Apps
              </p>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar os insights de aplicativos, primeiro conecte um tenant Microsoft 365.
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
          { label: 'Entra ID', href: '/scope-m365/entra-id' },
          { label: 'Aplicativos' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Aplicativos</h1>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Análise de riscos em App Registrations e Enterprise Apps do Entra ID
            </p>
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={refresh}
            disabled={insightsLoading}
          >
            <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Tenant Info */}
        {tenantsLoading ? (
          <Card className="mb-6">
            <CardContent className="py-4">
              <Skeleton className="h-5 w-48" />
            </CardContent>
          </Card>
        ) : connectedTenant && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      Tenant: {connectedTenant.display_name || connectedTenant.tenant_domain}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cliente: {connectedTenant.client.name}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  Conectado
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="mb-8">
          <AppInsightSummaryCards summary={summary} loading={insightsLoading} />
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive/30 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{error}</h3>
              {errorCode === 'CONFIG_NOT_FOUND' && (
                <p className="text-sm text-muted-foreground">
                  Configure as credenciais do aplicativo M365 para continuar.
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
            <AppInsightCategorySection 
              category="credential_expiration" 
              insights={insightsByCategory.credential_expiration}
              defaultOpen={true}
            />
            <AppInsightCategorySection 
              category="privileged_permissions" 
              insights={insightsByCategory.privileged_permissions}
              defaultOpen={true}
            />
            <AppInsightCategorySection 
              category="security_hygiene" 
              insights={insightsByCategory.security_hygiene}
              defaultOpen={true}
            />
          </div>
        )}

        {/* Empty State */}
        {!insightsLoading && !error && insights.length === 0 && hasInitialized && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum insight detectado</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Não foram encontrados indicadores de risco nos aplicativos do tenant. 
                Suas credenciais e permissões estão em conformidade.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
