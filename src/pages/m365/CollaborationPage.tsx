import { useEffect } from 'react';
import { formatDateTimeMediumBR } from '@/lib/dateUtils';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useCollaborationDashboard } from '@/hooks/useCollaborationDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { CollaborationScoreCard } from '@/components/m365/collaboration/CollaborationScoreCard';
import { TeamsOverviewCards } from '@/components/m365/collaboration/TeamsOverviewCards';
import { TeamsGovernanceCard } from '@/components/m365/collaboration/TeamsGovernanceCard';
import { SharePointOverviewCard, SharePointGovernanceCard } from '@/components/m365/collaboration/SharePointCards';
import {
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  MessageSquare,
  HardDrive,
  ExternalLink,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CollaborationPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const { data, loading, refreshing, error, refresh } = useCollaborationDashboard({ tenantRecordId: selectedTenantId });

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
          <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Colaboração' }]} />
          <h1 className="text-2xl font-bold text-foreground">Colaboração</h1>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar os dados de Teams e SharePoint, primeiro conecte um tenant Microsoft 365.
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

  const d = data;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Colaboração' }]} />

        {/* SEÇÃO 1: Contexto do Tenant */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Colaboração</h1>
            <p className="text-muted-foreground">Dashboard de governança do Microsoft Teams e SharePoint Online</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />Exportar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://admin.microsoft.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />M365 Admin
              </a>
            </Button>
            <Button className="gap-2" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <TenantSelector tenants={tenants} selectedId={selectedTenantId} onSelect={selectTenant} loading={tenantsLoading} />
              <div className="flex items-center gap-3">
                {d?.analyzedAt && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado em {formatDateTimeMediumBR(d.analyzedAt)}
                  </span>
                )}
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Conectado</Badge>
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

        {/* Empty state — no recent collection */}
        {!loading && !d && !error && (
          <Card className="border-muted bg-muted/5">
            <CardContent className="py-12 text-center">
              <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma coleta recente disponível</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Clique em Atualizar para iniciar a primeira coleta de dados de colaboração.
              </p>
              <Button className="gap-2" onClick={refresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Atualizando...' : 'Atualizar agora'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Dashboard sections — only when data exists */}
        {(d || loading) && (
          <>
            {/* SEÇÃO 2: Collaboration Security Score */}
            <CollaborationScoreCard data={d} loading={loading} />

            {/* SEÇÃO 3: Microsoft Teams Overview */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Microsoft Teams Overview
              </h2>
              <TeamsOverviewCards data={d} loading={loading} />
            </div>

            {/* SEÇÃO 4: Teams Governance */}
            <TeamsGovernanceCard data={d} loading={loading} />

            {/* SEÇÃO 5 + 6: SharePoint Overview + Governance */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                SharePoint Online
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SharePointOverviewCard data={d} loading={loading} />
                <SharePointGovernanceCard data={d} loading={loading} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
