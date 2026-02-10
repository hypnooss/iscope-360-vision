import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useEffectiveModules } from '@/hooks/useEffectiveModules';
import { useDashboardStats, RecentActivity, ModuleHealth } from '@/hooks/useDashboardStats';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ScoreGauge';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield, Cloud, Globe, Server, ArrowRight, Clock,
  AlertTriangle, ShieldAlert, Info, CheckCircle,
  Activity, MonitorCheck, LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Module metadata ──────────────────────────────────────────────────────────

const MODULE_META: Record<RecentActivity['module'], {
  icon: LucideIcon;
  label: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
}> = {
  firewall: {
    icon: Shield,
    label: 'Firewall',
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-500/10',
    borderColor: 'border-l-orange-500',
  },
  m365: {
    icon: Cloud,
    label: 'Microsoft 365',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
    borderColor: 'border-l-blue-500',
  },
  external_domain: {
    icon: Globe,
    label: 'Domínio Externo',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-500/10',
    borderColor: 'border-l-purple-500',
  },
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-primary';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
};

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
}

function ModuleHealthCard({
  title, icon: Icon, iconColor, iconBg, borderColor,
  health, assetLabel, loading, onAccess,
}: ModuleHealthCardProps) {
  const hasSeverities = health.severities.critical > 0 || health.severities.high > 0;

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

            {/* Score Gauge */}
            <div className="py-2">
              {health.score != null ? (
                <ScoreGauge score={health.score} size="sm" />
              ) : (
                <div className="flex flex-col items-center gap-1 py-4">
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground">Sem análise</span>
                </div>
              )}
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

// ─── Infrastructure Card ──────────────────────────────────────────────────────

function InfrastructureCard({
  agentsOnline, agentsTotal, totalAssets, lastOverallAnalysis, loading,
}: {
  agentsOnline: number;
  agentsTotal: number;
  totalAssets: number;
  lastOverallAnalysis: string | null;
  loading: boolean;
}) {
  const agentRatio = agentsTotal > 0 ? agentsOnline / agentsTotal : 0;
  const agentStatusColor = agentRatio >= 1 ? 'bg-emerald-400' : agentRatio > 0 ? 'bg-warning' : 'bg-destructive';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MonitorCheck className="w-4 h-4 text-muted-foreground" />
          Infraestrutura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <>
            {/* Agents */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-2.5 h-2.5 rounded-full', agentStatusColor)} />
                <span className="text-sm text-muted-foreground">Agents</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {agentsOnline}/{agentsTotal} online
              </span>
            </div>

            {/* Total assets */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total de ativos</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{totalAssets}</span>
            </div>

            {/* Last scan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Último scan</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {lastOverallAnalysis
                  ? formatDistanceToNow(new Date(lastOverallAnalysis), { addSuffix: true, locale: ptBR })
                  : '—'}
              </span>
            </div>
          </>
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

  const moduleCards = [
    hasFirewall && {
      key: 'firewall',
      moduleCode: 'scope_firewall',
      path: '/scope-firewall/dashboard',
      meta: MODULE_META.firewall,
      health: stats?.firewall,
      assetLabel: 'firewalls',
    },
    hasM365 && {
      key: 'm365',
      moduleCode: 'scope_m365',
      path: '/scope-m365/posture',
      meta: MODULE_META.m365,
      health: stats?.m365,
      assetLabel: 'tenants',
    },
    hasExtDomain && {
      key: 'external_domain',
      moduleCode: 'scope_external_domain',
      path: '/scope-external-domain/domains',
      meta: MODULE_META.external_domain,
      health: stats?.externalDomain,
      assetLabel: 'domínios',
    },
  ].filter(Boolean) as Array<{
    key: string;
    moduleCode: string;
    path: string;
    meta: typeof MODULE_META.firewall;
    health: ModuleHealth | undefined;
    assetLabel: string;
  }>;

  if (authLoading) return null;

  const emptyHealth: ModuleHealth = {
    score: null,
    assetCount: 0,
    lastAnalysisDate: null,
    severities: { critical: 0, high: 0, medium: 0, low: 0 },
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <PageBreadcrumb items={[{ label: 'Dashboard' }]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Painel executivo de segurança</p>
        </div>

        {/* ── SECTION 1: Module Health Cards ─────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Postura de Segurança por Módulo
          </h2>
          <div className={cn(
            'grid gap-4',
            moduleCards.length === 1 ? 'grid-cols-1 max-w-md' :
            moduleCards.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          )}>
            {moduleCards.map(({ key, moduleCode, path, meta, health, assetLabel }) => (
              <ModuleHealthCard
                key={key}
                title={meta.label}
                icon={meta.icon}
                iconColor={meta.iconColor}
                iconBg={meta.iconBg}
                borderColor={meta.borderColor}
                health={health || emptyHealth}
                assetLabel={assetLabel}
                loading={loading}
                onAccess={() => handleGoToModule(moduleCode, path)}
              />
            ))}
          </div>
        </section>

        {/* ── SECTION 2: Operational Summary ─────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Resumo Operacional
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Severity cards - takes 2 cols */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <Card key={i} className="glass-card">
                      <CardContent className="p-3">
                        <Skeleton className="h-4 w-16 mb-2" />
                        <Skeleton className="h-8 w-10" />
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <>
                    <StatCard
                      title="Críticos"
                      value={stats?.totalSeverities.critical || 0}
                      icon={ShieldAlert}
                      variant="destructive"
                      compact
                      delay={0}
                    />
                    <StatCard
                      title="Altos"
                      value={stats?.totalSeverities.high || 0}
                      icon={AlertTriangle}
                      variant="warning"
                      compact
                      delay={0.05}
                    />
                    <StatCard
                      title="Médios"
                      value={stats?.totalSeverities.medium || 0}
                      icon={Info}
                      variant="default"
                      compact
                      delay={0.1}
                    />
                    <StatCard
                      title="Baixos"
                      value={stats?.totalSeverities.low || 0}
                      icon={Shield}
                      variant="success"
                      compact
                      delay={0.15}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Infrastructure card */}
            <InfrastructureCard
              agentsOnline={stats?.agentsOnline || 0}
              agentsTotal={stats?.agentsTotal || 0}
              totalAssets={stats?.totalAssets || 0}
              lastOverallAnalysis={stats?.lastOverallAnalysis || null}
              loading={loading}
            />
          </div>
        </section>

        {/* ── SECTION 3: Recent Activity ─────────────────────────────── */}
        <section>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Atividade Recente
              </CardTitle>
              <CardDescription>Últimas análises realizadas em todos os módulos</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
              ) : !stats?.recentActivity.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma análise realizada ainda</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {stats.recentActivity.map((item) => {
                    const meta = MODULE_META[item.module];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={`${item.module}-${item.id}`}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className={cn('p-2 rounded-lg', meta.iconBg)}>
                          <Icon className={cn('w-5 h-5', meta.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{item.resourceName}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.clientName}</p>
                        </div>
                        {item.score != null && (
                          <div className="flex items-center gap-1.5">
                            {item.score >= 80 ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : item.score >= 60 ? (
                              <AlertTriangle className="w-4 h-4 text-warning" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                            <span className={cn('font-bold text-sm tabular-nums', getScoreColor(item.score))}>
                              {item.score}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
