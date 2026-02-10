import { useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useEffectiveModules } from '@/hooks/useEffectiveModules';
import { useDashboardStats, ModuleHealth } from '@/hooks/useDashboardStats';
import { useM365CVEs } from '@/hooks/useM365CVEs';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ScoreGauge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield, Cloud, Layers, Server, ArrowRight,
  AlertTriangle, ShieldAlert, LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Module Health Card ───────────────────────────────────────────────────────

interface ModuleHealthCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  health: ModuleHealth;
  assetLabel: string;
  loading: boolean;
  onAccess: () => void;
  extraInfo?: ReactNode;
  hideSeverities?: boolean;
}

function ModuleHealthCard({
  title, icon: Icon, iconColor, iconBg, borderColor,
  health, assetLabel, loading, onAccess, extraInfo, hideSeverities,
}: ModuleHealthCardProps) {
  const hasSeverities = !hideSeverities && (health.severities.critical > 0 || health.severities.high > 0);

  return (
    <Card
      className={cn(
        'glass-card border-l-4 cursor-pointer hover:scale-[1.02] transition-all duration-200 hover:shadow-lg',
        borderColor,
      )}
      onClick={onAccess}
    >
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-[100px] w-[100px] rounded-full mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Header */}
            <div className="flex items-center gap-2 w-full">
              <div className={cn('p-2 rounded-lg', iconBg)}>
                <Icon className={cn('w-5 h-5', iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground">
                  {health.assetCount} {assetLabel}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Score Gauge + Extra Info */}
            <div className="py-2 flex items-center gap-4">
              {health.score != null ? (
                <ScoreGauge score={health.score} size="sm" />
              ) : (
                <div className="flex flex-col items-center gap-1 py-4">
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground">Sem análise</span>
                </div>
              )}
              {extraInfo}
            </div>

            {/* Severity badges */}
            {hasSeverities && (
              <div className="flex items-center gap-2">
                {health.severities.critical > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1 px-2">
                    <ShieldAlert className="w-3 h-3" />
                    {health.severities.critical} críticos
                  </Badge>
                )}
                {health.severities.high > 0 && (
                  <Badge className="text-xs gap-1 px-2 bg-orange-500/15 text-orange-400 border-orange-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    {health.severities.high} altos
                  </Badge>
                )}
              </div>
            )}

            {/* Last analysis */}
            {health.lastAnalysisDate && (
              <p className="text-xs text-muted-foreground">
                Última análise:{' '}
                {formatDistanceToNow(new Date(health.lastAnalysisDate), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GeneralDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { setActiveModule } = useModules();
  const { hasEffectiveModuleAccess } = useEffectiveModules();
  const { stats, loading } = useDashboardStats();
  const { data: cveData } = useM365CVEs(1);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleGoToModule = (moduleCode: string, path: string) => {
    setActiveModule(moduleCode as any);
    navigate(path);
  };

  const hasFirewall = hasEffectiveModuleAccess('scope_firewall');
  const hasM365 = hasEffectiveModuleAccess('scope_m365');
  const hasExtDomain = hasEffectiveModuleAccess('scope_external_domain');

  const emptyHealth: ModuleHealth = {
    score: null,
    assetCount: 0,
    lastAnalysisDate: null,
    severities: { critical: 0, high: 0, medium: 0, low: 0 },
  };



  const recentCVECount = cveData?.totalCVEs ?? 0;

  type CardDef = {
    key: string;
    title: string;
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
    borderColor: string;
    health: ModuleHealth;
    assetLabel: string;
    moduleCode: string;
    path: string;
    extraInfo?: ReactNode;
    hideSeverities?: boolean;
  };

  const moduleCards: CardDef[] = [
    hasFirewall && {
      key: 'firewall',
      title: 'Firewall',
      icon: Shield,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      borderColor: 'border-l-orange-500',
      health: stats?.firewall || emptyHealth,
      assetLabel: 'firewalls',
      moduleCode: 'scope_firewall',
      path: '/scope-firewall/dashboard',
    },
    hasM365 && {
      key: 'm365',
      title: 'Microsoft 365',
      icon: Cloud,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      borderColor: 'border-l-blue-500',
      health: stats?.m365 || emptyHealth,
      assetLabel: 'tenants',
      moduleCode: 'scope_m365',
      path: '/scope-m365/posture',
      hideSeverities: true,
      extraInfo: recentCVECount > 0 ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-bold text-foreground">{recentCVECount}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded animate-pulse">NEW</span>
            <span className="text-xs text-muted-foreground">CVEs</span>
          </div>
        </div>
      ) : undefined,
    },
    hasExtDomain && {
      key: 'external_domain',
      title: 'Domínio Externo',
      icon: Layers,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
      borderColor: 'border-l-green-500',
      health: stats?.externalDomain || emptyHealth,
      assetLabel: 'domínios',
      moduleCode: 'scope_external_domain',
      path: '/scope-external-domain/domains',
    },
  ].filter(Boolean) as CardDef[];

  // Infrastructure metrics
  const totalAssets = stats
    ? (stats.firewall.assetCount + stats.m365.assetCount + stats.externalDomain.assetCount)
    : 0;

  const lastOverallScan = stats
    ? [stats.firewall.lastAnalysisDate, stats.m365.lastAnalysisDate, stats.externalDomain.lastAnalysisDate]
        .filter(Boolean)
        .sort()
        .pop() || null
    : null;

  const agentStatusColor = stats
    ? stats.agentsTotal === 0
      ? 'bg-muted-foreground'
      : stats.agentsOnline === stats.agentsTotal
      ? 'bg-emerald-500'
      : stats.agentsOnline > 0
      ? 'bg-yellow-500'
      : 'bg-destructive'
    : 'bg-muted-foreground';

  const gridCols = moduleCards.length <= 2
    ? 'grid-cols-1 md:grid-cols-2'
    : moduleCards.length === 3
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <PageBreadcrumb items={[{ label: 'Dashboard' }]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Painel executivo de segurança</p>
        </div>

        {/* Module Health Cards */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Postura de Segurança por Módulo
          </h2>
          <div className={cn('grid gap-4', gridCols)}>
            {moduleCards.map(({ key, title, icon, iconColor, iconBg, borderColor, health, assetLabel, moduleCode, path, extraInfo, hideSeverities }) => (
              <ModuleHealthCard
                key={key}
                title={title}
                icon={icon}
                iconColor={iconColor}
                iconBg={iconBg}
                borderColor={borderColor}
                health={health}
                assetLabel={assetLabel}
                loading={loading}
                onAccess={() => handleGoToModule(moduleCode, path)}
                extraInfo={extraInfo}
                hideSeverities={hideSeverities}
              />
            ))}
          </div>
        </section>

        {/* Infrastructure Card */}
        <section>
          <Card
            className="glass-card border-t-4 border-t-emerald-500 cursor-pointer hover:scale-[1.01] transition-all duration-200 hover:shadow-lg"
            onClick={() => navigate('/agents')}
          >
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Server className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h3 className="font-semibold text-foreground">Infraestrutura</h3>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', agentStatusColor)} />
                      <span className="text-sm text-muted-foreground">Agents</span>
                      <span className="text-sm font-semibold text-foreground ml-auto">
                        {stats?.agentsOnline ?? 0}/{stats?.agentsTotal ?? 0} online
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total de ativos</span>
                      <span className="text-sm font-semibold text-foreground ml-auto">
                        {totalAssets}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Último scan</span>
                      <span className="text-sm font-semibold text-foreground ml-auto">
                        {lastOverallScan
                          ? formatDistanceToNow(new Date(lastOverallScan), { addSuffix: true, locale: ptBR })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
