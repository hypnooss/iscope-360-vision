import { useEffect, useState } from 'react';
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
import { EntraIdStatsCard } from '@/components/m365/entra-id/EntraIdStatsCard';
import { EntraIdDonutChart } from '@/components/m365/entra-id/EntraIdDonutChart';
import {
  RefreshCw,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  ShieldCheck,
  KeyRound,
  Activity,
  UserCog,
  Lock,
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

  const d = data;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365', href: '/scope-m365/dashboard' }, { label: 'Entra ID' }]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entra ID</h1>
            <p className="text-muted-foreground">Visão operacional de identidades, segurança e atividades</p>
          </div>
          <Button className="gap-2" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Carregando...' : 'Atualizar'}
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

        {/* Dashboard Grid - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Identidades */}
          <div className="space-y-4">
            <EntraIdStatsCard
              title="Entra ID"
              icon={Users}
              loading={loading}
              rows={[
                { label: 'Usuários', value: d?.users.total ?? 0 },
                { label: 'Sign-In Habilitado', value: d?.users.signInEnabled ?? 0, color: 'text-green-500' },
                { label: 'Desabilitados', value: d?.users.disabled ?? 0, color: 'text-destructive' },
                { label: 'Convidados (Guests)', value: d?.users.guests ?? 0, color: 'text-warning' },
                { label: 'On-Premises Sync', value: d?.users.onPremSynced ?? 0, color: 'text-primary' },
              ]}
            />
            <EntraIdStatsCard
              title="Administradores"
              icon={UserCog}
              loading={loading}
              rows={[
                { label: 'Total de Admins', value: d?.admins.total ?? 0 },
                { label: 'Global Admins', value: d?.admins.globalAdmins ?? 0, color: 'text-destructive' },
              ]}
            />
          </div>

          {/* Column 2: Segurança */}
          <div className="space-y-4">
            <EntraIdDonutChart
              title="Status MFA dos Usuários"
              icon={KeyRound}
              loading={loading}
              centerValue={d?.mfa.total ?? 0}
              centerLabel="Total"
              segments={[
                { name: 'MFA Habilitado', value: d?.mfa.enabled ?? 0, color: 'hsl(142, 71%, 45%)' },
                { name: 'MFA Desabilitado', value: d?.mfa.disabled ?? 0, color: 'hsl(0, 84%, 60%)' },
              ]}
            />
            <EntraIdStatsCard
              title="Azure AD Risks (30 dias)"
              icon={ShieldCheck}
              loading={loading}
              rows={[
                { label: 'Usuários em Risco', value: d?.risks.riskyUsers ?? 0, color: d?.risks.riskyUsers ? 'text-warning' : 'text-green-500' },
                { label: 'Em Risco Ativo', value: d?.risks.atRisk ?? 0, color: d?.risks.atRisk ? 'text-destructive' : 'text-muted-foreground' },
                { label: 'Comprometidos', value: d?.risks.compromised ?? 0, color: d?.risks.compromised ? 'text-destructive' : 'text-muted-foreground' },
              ]}
            />
          </div>

          {/* Column 3: Atividade */}
          <div className="space-y-4">
            <EntraIdDonutChart
              title="Atividade de Login (30 dias)"
              icon={Activity}
              loading={loading}
              centerValue={d?.loginActivity.total ?? 0}
              centerLabel="Total"
              segments={[
                { name: 'Sucesso', value: d?.loginActivity.success ?? 0, color: 'hsl(142, 71%, 45%)' },
                { name: 'Falha', value: d?.loginActivity.failed ?? 0, color: 'hsl(0, 84%, 60%)' },
                { name: 'MFA Requerido', value: d?.loginActivity.mfaRequired ?? 0, color: 'hsl(217, 91%, 60%)' },
                { name: 'Bloqueado', value: d?.loginActivity.blocked ?? 0, color: 'hsl(25, 95%, 53%)' },
              ]}
            />
            <EntraIdDonutChart
              title="Alterações de Usuário (30 dias)"
              icon={Users}
              loading={loading}
              centerValue={
                (d?.userChanges.updated ?? 0) + (d?.userChanges.new ?? 0) + (d?.userChanges.enabled ?? 0) +
                (d?.userChanges.disabled ?? 0) + (d?.userChanges.deleted ?? 0)
              }
              centerLabel="Total"
              segments={[
                { name: 'Atualizados', value: d?.userChanges.updated ?? 0, color: 'hsl(217, 91%, 60%)' },
                { name: 'Novos', value: d?.userChanges.new ?? 0, color: 'hsl(142, 71%, 45%)' },
                { name: 'Habilitados', value: d?.userChanges.enabled ?? 0, color: 'hsl(162, 63%, 41%)' },
                { name: 'Desabilitados', value: d?.userChanges.disabled ?? 0, color: 'hsl(25, 95%, 53%)' },
                { name: 'Deletados', value: d?.userChanges.deleted ?? 0, color: 'hsl(0, 84%, 60%)' },
              ]}
            />
            <EntraIdStatsCard
              title="Atividade de Senhas (7 dias)"
              icon={Lock}
              loading={loading}
              rows={[
                { label: 'Resets por Admin', value: d?.passwordActivity.resets ?? 0 },
                { label: 'Alterações Forçadas', value: d?.passwordActivity.forcedChanges ?? 0, color: 'text-warning' },
                { label: 'Self-Service', value: d?.passwordActivity.selfService ?? 0, color: 'text-primary' },
              ]}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
