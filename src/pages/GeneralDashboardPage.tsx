import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useEffectiveModules } from '@/hooks/useEffectiveModules';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useDashboardStats, ModuleHealth, SeverityBlock } from '@/hooks/useDashboardStats';
import { MODULE_DASHBOARD_CONFIG } from '@/config/moduleDashboardConfig';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreGauge } from '@/components/ScoreGauge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Cloud, Layers, Server, ArrowRight,
  AlertTriangle, ShieldAlert, LucideIcon, Building2, Bot,
  Globe, Network, CheckCircle2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

// ─── Icon map: resolves DB string → Lucide component ─────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Shield, Cloud, Layers, Globe, Server, Network, Bot,
};

// ─── Static color maps for Tailwind JIT (dynamic class concatenation doesn't work reliably) ──
const BORDER_COLOR_MAP: Record<string, string> = {
  'orange-500': 'border-l-orange-500',
  'blue-500': 'border-l-blue-500',
  'green-500': 'border-l-green-500',
  'primary': 'border-l-primary',
  'red-500': 'border-l-red-500',
  'violet-500': 'border-l-violet-500',
  'yellow-500': 'border-l-yellow-500',
  'cyan-500': 'border-l-cyan-500',
};

const ICON_BG_MAP: Record<string, string> = {
  'orange-500': 'bg-orange-500/10',
  'blue-500': 'bg-blue-500/10',
  'green-500': 'bg-green-500/10',
  'primary': 'bg-primary/10',
  'red-500': 'bg-red-500/10',
  'violet-500': 'bg-violet-500/10',
  'yellow-500': 'bg-yellow-500/10',
  'cyan-500': 'bg-cyan-500/10',
};

// ─── Module Health Card ───────────────────────────────────────────────────────

interface ModuleHealthCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  health: ModuleHealth;
  loading: boolean;
  onAccess: () => void;
}

const SEVERITY_ITEMS = [
  { key: 'critical' as const, label: 'Crítico', icon: ShieldAlert, badgeCn: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { key: 'high' as const, label: 'Alto', icon: AlertTriangle, badgeCn: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { key: 'medium' as const, label: 'Médio', icon: Info, badgeCn: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { key: 'low' as const, label: 'Baixo', icon: Info, badgeCn: 'bg-blue-400/15 text-blue-400 border-blue-400/30' },
] as const;

function SeverityColumn({ title, severities }: { title: string; severities: SeverityBlock }) {
  const total = severities.critical + severities.high + severities.medium + severities.low;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-0.5">{title}</span>
      {total > 0 ? (
        SEVERITY_ITEMS.map(({ key, label, icon: SevIcon, badgeCn }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Badge className={cn('text-xs gap-1 px-1.5 min-w-[24px] justify-center', badgeCn)}>
              <SevIcon className="w-3 h-3" />
              {severities[key]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))
      ) : (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Nenhum</span>
        </div>
      )}
    </div>
  );
}

function ModuleHealthCard({
  title, icon: Icon, iconColor, iconBg, borderColor,
  health, loading, onAccess,
}: ModuleHealthCardProps) {
  const hasCves = !!health.cveSeverities;

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
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center gap-2 w-full">
              <div className={cn('p-2 rounded-lg', iconBg)}>
                <Icon className={cn('w-5 h-5', iconColor)} />
              </div>
              <h3 className="font-semibold text-foreground text-sm flex-1">{title}</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Score Gauge + Severity columns */}
            <div className="flex items-center justify-evenly py-2">
              <div className="shrink-0">
                {health.score != null ? (
                  <ScoreGauge score={health.score} size="sm" />
                ) : (
                  <div className="flex flex-col items-center gap-1 py-4">
                    <span className="text-2xl font-bold text-muted-foreground">—</span>
                    <span className="text-xs text-muted-foreground">Sem análise</span>
                  </div>
                )}
              </div>

              {/* Severity columns: CVEs + Conformidade when CVEs exist, or just Conformidade */}
              <div className={cn('flex gap-10')}>
                {hasCves && (
                  <SeverityColumn title="CVEs" severities={health.cveSeverities!} />
                )}
                <SeverityColumn
                  title={hasCves ? 'Conformidade' : ''}
                  severities={health.severities}
                />
              </div>
            </div>

            {/* Last analysis */}
            {health.lastAnalysisDate && (
              <p className="text-xs text-muted-foreground text-center">
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

const emptyHealth: ModuleHealth = {
  score: null,
  assetCount: 0,
  lastAnalysisDate: null,
  severities: { critical: 0, high: 0, medium: 0, low: 0 },
};

export default function GeneralDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { setActiveModule } = useModules();
  const { effectiveUserModules } = useEffectiveModules();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);

  const { stats, loading } = useDashboardStats(selectedWorkspaceId);

  // Fetch workspaces for super roles
  useEffect(() => {
    if (!isSuperRole) return;
    const fetchWorkspaces = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (data) setWorkspaces(data);
    };
    fetchWorkspaces();
  }, [isSuperRole]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleGoToModule = (moduleCode: string, path: string) => {
    setActiveModule(moduleCode as any);
    navigate(path);
  };

  // ─── Build dynamic module cards from effectiveUserModules + config ──────────

  type CardDef = {
    key: string;
    title: string;
    icon: LucideIcon;
    iconColor: string;
    iconBg: string;
    borderColor: string;
    health: ModuleHealth;
    moduleCode: string;
    path: string;
    infraLabel: string;
  };

  const moduleCards: CardDef[] = effectiveUserModules
    .filter(um => um.permission !== 'none')
    .map(um => {
      const config = MODULE_DASHBOARD_CONFIG[um.module.code];
      if (!config) return null;

      const Icon = ICON_MAP[um.module.icon || ''] || Shield;
      const colorBase = um.module.color?.replace('text-', '') || 'primary';

      return {
        key: um.module.code,
        title: um.module.name,
        icon: Icon,
        iconColor: um.module.color || 'text-primary',
        iconBg: ICON_BG_MAP[colorBase] || 'bg-primary/10',
        borderColor: BORDER_COLOR_MAP[colorBase] || 'border-l-primary',
        health: stats?.modules[config.statsKey] || emptyHealth,
        moduleCode: um.module.code,
        path: config.path,
        infraLabel: config.infraLabel,
      } as CardDef;
    })
    .filter(Boolean) as CardDef[];

  // ─── Derived metrics ───────────────────────────────────────────────────────

  const lastOverallScan = stats
    ? Object.values(stats.modules)
        .map(m => m.lastAnalysisDate)
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
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  // Infrastructure grid: modules + agents (always present)
  const infraColCount = moduleCards.length + 1; // +1 for Agents
  const infraGridCols = infraColCount <= 2
    ? 'grid-cols-2'
    : infraColCount === 3
    ? 'grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 lg:grid-cols-4';

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Dashboard' }]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Postura de Segurança por Módulo</p>
          </div>
          {isSuperRole && workspaces.length > 0 && (
            <Select
              value={selectedWorkspaceId ?? 'all'}
              onValueChange={(v) => setSelectedWorkspaceId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[220px] bg-background">
                <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todos os workspaces" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Todos os workspaces</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Module Health Cards */}
        <section>
          <div className={cn('grid gap-4', gridCols)}>
            {moduleCards.map((card) => (
              <ModuleHealthCard
                key={card.key}
                title={card.title}
                icon={card.icon}
                iconColor={card.iconColor}
                iconBg={card.iconBg}
                borderColor={card.borderColor}
                health={card.health}
                loading={loading}
                onAccess={() => handleGoToModule(card.moduleCode, card.path)}
              />
            ))}
          </div>
        </section>

        {/* Infrastructure Card */}
        <section>
          <Card
            className="glass-card border-t-4 border-t-violet-500 cursor-pointer hover:scale-[1.01] transition-all duration-200 hover:shadow-lg"
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
                       <div className="p-2 rounded-lg bg-violet-500/10">
                        <Server className="w-5 h-5 text-violet-500" />
                      </div>
                      <h3 className="font-semibold text-foreground">Infraestrutura</h3>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Assets by module - dynamic */}
                  <div className={cn('grid gap-4', infraGridCols)}>
                    {moduleCards.map((card) => {
                      const CardIcon = card.icon;
                      return (
                        <div key={card.key} className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-1.5">
                            <CardIcon className={cn('w-4 h-4', card.iconColor)} />
                            <span className="text-base text-muted-foreground">{card.title}</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Total</span>
                          <span className="text-lg font-bold text-foreground">
                            {card.health.assetCount}
                          </span>
                        </div>
                      );
                    })}

                    {/* Agents - always present */}
                    <div className="flex flex-col items-center gap-0.5 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-violet-500" />
                        <span className="text-base text-muted-foreground">Agents</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Online</span>
                      <span className="text-lg font-bold text-foreground">
                        {stats?.agentsOnline ?? 0}/{stats?.agentsTotal ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Last scan */}
                  {lastOverallScan && (
                    <p className="text-xs text-muted-foreground">
                      Último scan:{' '}
                      {formatDistanceToNow(new Date(lastOverallScan), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
