import { useEffect } from 'react';
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
import { M365StatsCard } from '@/components/m365/shared/M365StatsCard';
import { M365DonutChart } from '@/components/m365/shared/M365DonutChart';
import {
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  Globe,
  MessageSquare,
  HardDrive,
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Colaboração</h1>
            <p className="text-muted-foreground">Visão operacional do Microsoft Teams e SharePoint Online</p>
          </div>
          <Button className="gap-2" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        {/* Tenant Selector */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <TenantSelector tenants={tenants} selectedId={selectedTenantId} onSelect={selectTenant} loading={tenantsLoading} />
              <div className="flex items-center gap-3">
                {d?.analyzedAt && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado em {format(new Date(d.analyzedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
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

        {/* Section: Teams */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Microsoft Teams
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <M365StatsCard
              title="Equipes"
              icon={Users}
              loading={loading}
              rows={[
                { label: 'Total de Teams', value: d?.teams.total ?? 0 },
                { label: 'Públicas', value: d?.teams.public ?? 0, color: 'text-green-500' },
                { label: 'Privadas', value: d?.teams.private ?? 0, color: 'text-primary' },
                { label: 'Com Convidados', value: d?.teams.withGuests ?? 0, color: 'text-warning' },
              ]}
            />
            <M365DonutChart
              title="Visibilidade das Equipes"
              icon={Users}
              loading={loading}
              centerValue={d?.teams.total ?? 0}
              centerLabel="Total"
              segments={[
                { name: 'Públicas', value: d?.teams.public ?? 0, color: 'hsl(142, 71%, 45%)' },
                { name: 'Privadas', value: d?.teams.private ?? 0, color: 'hsl(217, 91%, 60%)' },
              ]}
            />
            <M365StatsCard
              title="Canais"
              icon={MessageSquare}
              loading={loading}
              rows={[
                { label: 'Canais Privados', value: d?.teams.privateChannels ?? 0, color: 'text-primary' },
                { label: 'Canais Compartilhados', value: d?.teams.sharedChannels ?? 0, color: 'text-warning' },
              ]}
            />
          </div>
        </div>

        {/* Section: SharePoint */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            SharePoint Online
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <M365StatsCard
              title="Sites"
              icon={Globe}
              loading={loading}
              rows={[
                { label: 'Total de Sites', value: d?.sharepoint.totalSites ?? 0 },
                { label: 'Sites Ativos (30 dias)', value: d?.sharepoint.activeSites ?? 0, color: 'text-green-500' },
                { label: 'Sites Inativos', value: d?.sharepoint.inactiveSites ?? 0, color: 'text-warning' },
                { label: 'Compartilhamento Externo', value: d?.sharepoint.externalSharingEnabled ?? 0, color: 'text-destructive' },
              ]}
            />
            <M365DonutChart
              title="Atividade dos Sites"
              icon={HardDrive}
              loading={loading}
              centerValue={d?.sharepoint.totalSites ?? 0}
              centerLabel="Total"
              segments={[
                { name: 'Ativos', value: d?.sharepoint.activeSites ?? 0, color: 'hsl(142, 71%, 45%)' },
                { name: 'Inativos', value: d?.sharepoint.inactiveSites ?? 0, color: 'hsl(25, 95%, 53%)' },
              ]}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
