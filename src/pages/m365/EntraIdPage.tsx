import { useEffect } from 'react';
import { formatDateTimeMediumBR } from '@/lib/dateUtils';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useEntraIdDashboard } from '@/hooks/useEntraIdDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { IdentityScoreCard } from '@/components/m365/entra-id/IdentityScoreCard';
import { IdentityOverviewCards } from '@/components/m365/entra-id/IdentityOverviewCards';
import { AuthPostureCard } from '@/components/m365/entra-id/AuthPostureCard';
import { IdentityRiskCard } from '@/components/m365/entra-id/IdentityRiskCard';
import { LoginActivityCard } from '@/components/m365/entra-id/LoginActivityCard';
import { GovernanceCards } from '@/components/m365/entra-id/GovernanceCards';
import {
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  ExternalLink,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EntraIdPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const { data, loading, refreshing, error, refresh } = useEntraIdDashboard({ tenantRecordId: selectedTenantId });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasModuleAccess('scope_m365')) navigate('/modules');
  }, [user, authLoading, hasModuleAccess, navigate]);

  if (authLoading) return null;

  // No tenant
  if (!tenantsLoading && tenants.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Entra ID' }]} />
          <h1 className="text-2xl font-bold text-foreground">Entra ID</h1>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar o dashboard do Entra ID, primeiro conecte um tenant Microsoft 365.
              </p>
              <Button asChild className="gap-2">
                <Link to="/environment/new/m365"><LinkIcon className="w-4 h-4" />Conectar Tenant</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Entra ID' }]} />

        {/* SEÇÃO 1: Contexto do Tenant */}
        <Card className="border-primary/20 bg-card/80">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <TenantSelector tenants={tenants} selectedId={selectedTenantId} onSelect={selectTenant} loading={tenantsLoading} />
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Conectado</Badge>
                {data?.analyzedAt && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado em {formatDateTimeMediumBR(data.analyzedAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2 text-xs" disabled>
                  <Download className="w-3.5 h-3.5" />Exportar
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-xs" asChild>
                  <a href="https://entra.microsoft.com" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />Abrir no Entra ID
                  </a>
                </Button>
                <Button size="sm" className="gap-2 text-xs" onClick={refresh} disabled={refreshing}>
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{error}</h3>
            </CardContent>
          </Card>
        )}

        {/* SEÇÃO 2: Score de Segurança de Identidade */}
        <IdentityScoreCard data={data} loading={loading} />

        {/* SEÇÃO 3: Visão Geral da Identidade */}
        <IdentityOverviewCards data={data} loading={loading} />

        {/* SEÇÃO 4: Postura de Autenticação */}
        <AuthPostureCard data={data} loading={loading} />

        {/* SEÇÕES 5 & 6: Risco + Login Activity (side by side) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <IdentityRiskCard data={data} loading={loading} />
          <LoginActivityCard data={data} loading={loading} />
        </div>

        {/* SEÇÃO 7: Governança de Usuários */}
        <GovernanceCards data={data} loading={loading} />
      </div>
    </AppLayout>
  );
}
