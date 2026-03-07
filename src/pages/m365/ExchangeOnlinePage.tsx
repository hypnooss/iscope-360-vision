import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useExchangeDashboard } from '@/hooks/useExchangeDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { EmailSecurityScoreCard } from '@/components/m365/exchange/EmailSecurityScoreCard';
import { ExchangeOverviewCards } from '@/components/m365/exchange/ExchangeOverviewCards';
import { EmailSecurityPostureCard } from '@/components/m365/exchange/EmailSecurityPostureCard';
import { EmailTrafficCard } from '@/components/m365/exchange/EmailTrafficCard';
import { MailboxHealthCard } from '@/components/m365/exchange/MailboxHealthCard';
import {
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  Download,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExchangeOnlinePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const { data, loading, refreshing, error, refresh } = useExchangeDashboard({ tenantRecordId: selectedTenantId });

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
          <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Exchange Online' }]} />
          <h1 className="text-2xl font-bold text-foreground">Exchange Online</h1>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para visualizar o dashboard do Exchange Online, primeiro conecte um tenant Microsoft 365.
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

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Exchange Online' }]} />

        {/* SEÇÃO 1: Contexto do Tenant */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exchange Online</h1>
            <p className="text-muted-foreground">Dashboard operacional e postura de segurança do email</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />Exportar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://admin.exchange.microsoft.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />Exchange Admin
              </a>
            </Button>
            <Button size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
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
                {data?.analyzedAt && (
                  <span className="text-xs text-muted-foreground">
                    Atualizado em {format(new Date(data.analyzedAt), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
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

        {/* SEÇÃO 2: Email Security Score */}
        <EmailSecurityScoreCard data={data} loading={loading} />

        {/* SEÇÃO 3: Visão Geral do Exchange */}
        <ExchangeOverviewCards data={data} loading={loading} />

        {/* SEÇÃO 4 & 5: Segurança + Tráfego */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmailSecurityPostureCard data={data} loading={loading} />
          <EmailTrafficCard data={data} loading={loading} />
        </div>

        {/* SEÇÃO 6: Configuração e Saúde */}
        <MailboxHealthCard data={data} loading={loading} />
      </div>
    </AppLayout>
  );
}
