import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useEffectiveModules } from '@/hooks/useEffectiveModules';
import { useDashboardStats, RecentActivity } from '@/hooks/useDashboardStats';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ScoreGauge';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Cloud, Globe, Server, ArrowRight, Clock, AlertTriangle, ShieldAlert, Info, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Module icon/color mapping ────────────────────────────────────────────────

const MODULE_META: Record<RecentActivity['module'], { icon: typeof Shield; color: string; label: string }> = {
  firewall: { icon: Shield, color: 'text-orange-500 bg-orange-500/10', label: 'Firewall' },
  m365: { icon: Cloud, color: 'text-blue-500 bg-blue-500/10', label: 'M365' },
  external_domain: { icon: Globe, color: 'text-purple-500 bg-purple-500/10', label: 'Domínio Ext.' },
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-primary';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-warning';
  return 'text-destructive';
};

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

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <PageBreadcrumb items={[{ label: 'Dashboard Geral' }]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Geral</h1>
          <p className="text-muted-foreground">Visão consolidada de segurança</p>
        </div>

        {/* ── SECTION 1: Score + Assets ─────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Score Gauge */}
          <Card className="glass-card flex items-center justify-center p-6 lg:min-w-[220px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-[160px] w-[160px] rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ScoreGauge
                  score={stats?.consolidatedScore ?? 0}
                  size="md"
                  loading={stats?.consolidatedScore == null}
                />
                <p className="text-xs text-muted-foreground mt-1">Score Consolidado</p>
              </div>
            )}
          </Card>

          {/* Asset Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
            {/* Firewalls */}
            <AssetCard
              label="Firewalls"
              value={stats?.totalFirewalls}
              icon={Shield}
              color="orange"
              loading={loading}
              enabled={hasFirewall}
              onAccess={() => handleGoToModule('scope_firewall', '/scope-firewall/dashboard')}
            />
            {/* M365 Tenants */}
            <AssetCard
              label="Tenants M365"
              value={stats?.totalM365Tenants}
              icon={Cloud}
              color="blue"
              loading={loading}
              enabled={hasM365}
              onAccess={() => handleGoToModule('scope_m365', '/scope-m365/posture')}
            />
            {/* External Domains */}
            <AssetCard
              label="Domínios Externos"
              value={stats?.totalExternalDomains}
              icon={Globe}
              color="purple"
              loading={loading}
              enabled={hasExtDomain}
              onAccess={() => handleGoToModule('scope_external_domain', '/scope-external-domain/domains')}
            />
            {/* Agents */}
            <AssetCard
              label="Agents"
              value={stats?.agentsTotal}
              subtitle={stats ? `${stats.agentsOnline} online` : undefined}
              icon={Server}
              color="emerald"
              loading={loading}
              enabled={true}
            />
          </div>
        </div>

        {/* ── SECTION 2: Severity Summary ──────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Severidades Cross-Module
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <Card key={i} className="glass-card">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-8 w-10" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard
                  title="Críticos"
                  value={stats?.severities.critical || 0}
                  icon={ShieldAlert}
                  variant="destructive"
                  compact
                  delay={0}
                />
                <StatCard
                  title="Altos"
                  value={stats?.severities.high || 0}
                  icon={AlertTriangle}
                  variant="warning"
                  compact
                  delay={0.05}
                />
                <StatCard
                  title="Médios"
                  value={stats?.severities.medium || 0}
                  icon={Info}
                  variant="default"
                  compact
                  delay={0.1}
                />
                <StatCard
                  title="Baixos"
                  value={stats?.severities.low || 0}
                  icon={Shield}
                  variant="success"
                  compact
                  delay={0.15}
                />
              </>
            )}
          </div>
        </div>

        {/* ── SECTION 3: Recent Activity ───────────────────────────── */}
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
              <div className="space-y-2">
                {stats.recentActivity.map((item) => {
                  const meta = MODULE_META[item.module];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${item.module}-${item.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className={cn('p-2 rounded-lg', meta.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{item.resourceName}</p>
                        <p className="text-sm text-muted-foreground truncate">{item.clientName}</p>
                      </div>
                      {item.score != null && (
                        <div className="flex items-center gap-1.5">
                          {item.score >= 80 ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : item.score >= 60 ? (
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          )}
                          <span className={cn('font-bold text-sm', getScoreColor(item.score))}>
                            {item.score}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ─── Asset Card sub-component ─────────────────────────────────────────────────

interface AssetCardProps {
  label: string;
  value: number | undefined;
  subtitle?: string;
  icon: typeof Shield;
  color: 'orange' | 'blue' | 'purple' | 'emerald';
  loading: boolean;
  enabled: boolean;
  onAccess?: () => void;
}

const COLOR_MAP: Record<AssetCardProps['color'], { border: string; bg: string; text: string }> = {
  orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500' },
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  purple: { border: 'border-l-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-500' },
  emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
};

function AssetCard({ label, value, subtitle, icon: Icon, color, loading, enabled, onAccess }: AssetCardProps) {
  const c = COLOR_MAP[color];
  return (
    <Card className={cn('glass-card border-l-4', c.border, !enabled && 'opacity-60')}>
      <CardContent className="p-4 flex flex-col gap-2">
        {loading ? (
          <>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded-lg', c.bg)}>
                <Icon className={cn('w-4 h-4', c.text)} />
              </div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {enabled ? (value ?? 0) : '—'}
            </p>
            {subtitle && enabled && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {enabled && onAccess && (
              <Button
                variant="ghost"
                size="sm"
                className={cn('gap-1 mt-1 px-0 h-7', c.text)}
                onClick={onAccess}
              >
                Acessar <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
