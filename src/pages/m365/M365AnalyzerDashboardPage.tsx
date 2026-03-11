import { useEffect, useRef, useState } from 'react';
import { formatShortDateTimeBR } from '@/lib/dateUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useLatestM365AnalyzerSnapshot, useM365AnalyzerProgress, useM365AnalyzerDiff } from '@/hooks/useM365AnalyzerData';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { IncidentDetailSheet } from '@/components/m365/analyzer/IncidentDetailSheet';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, AlertOctagon, Info, Play,
  Users, ExternalLink, FileWarning,
  Clock, Settings, Loader2, Activity,
  UserX, Send, ShieldAlert, ShieldCheck,
  TrendingUp, TrendingDown, Minus, Eye,
  Ban, Search, CheckCircle2, Radar,
  ToggleLeft, Lightbulb,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import type { M365AnalyzerInsight, M365AnalyzerCategory } from '@/types/m365AnalyzerInsights';
import { ExternalMovementTab } from '@/components/m365/analyzer/ExternalMovementTab';
import { ThreatProtectionTab } from '@/components/m365/analyzer/ThreatProtectionTab';
import { useExternalMovementData } from '@/hooks/useExternalMovementData';
import { useThreatDismissals } from '@/hooks/useThreatDismissals';
import { AnalyzerKPIRow, type KPIFilterKey } from '@/components/m365/analyzer/AnalyzerKPIRow';
import { AnalyzerScoreSparkline } from '@/components/m365/analyzer/AnalyzerScoreSparkline';
import { SnapshotDiffBanner } from '@/components/m365/analyzer/SnapshotDiffBanner';

// ─── Operational categories only ─────────────────────────────────────────────
const OPERATIONAL_CATEGORIES: M365AnalyzerCategory[] = [
  'security_risk',
  'account_compromise',
  'suspicious_rules',
  'phishing_threats',
];

const ANOMALY_CATEGORIES: M365AnalyzerCategory[] = [
  'behavioral_baseline',
  'exfiltration',
];

const ALL_RADAR_CATEGORIES = [...OPERATIONAL_CATEGORIES, ...ANOMALY_CATEGORIES];

// ─── Severity config ─────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: { label: 'Critical', icon: AlertOctagon, border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-400', glow: 'shadow-[0_0_12px_hsl(350_70%_50%/0.15)]' },
  high: { label: 'High', icon: AlertTriangle, border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-400', glow: '' },
  medium: { label: 'Medium', icon: Shield, border: 'border-warning/40', bg: 'bg-warning/10', text: 'text-warning', glow: '' },
  low: { label: 'Low', icon: Info, border: 'border-primary/30', bg: 'bg-primary/10', text: 'text-primary', glow: '' },
} as const;

// ─── Configurational keywords to filter out ──────────────────────────────────
const CONFIG_KEYWORDS = [
  'desabilitado', 'disabled', 'configuração', 'configuracao', 'policy',
  'habilitado', 'enabled', 'anti-spam', 'intelligence',
];

function isConfigurationalInsight(insight: M365AnalyzerInsight): boolean {
  const name = insight.name.toLowerCase();
  if (CONFIG_KEYWORDS.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function riskLevel(score: number): { label: string; color: string } {
  if (score >= 81) return { label: 'CRÍTICO', color: 'text-rose-400' };
  if (score >= 61) return { label: 'ALTO', color: 'text-orange-400' };
  if (score >= 31) return { label: 'MODERADO', color: 'text-warning' };
  return { label: 'BAIXO', color: 'text-emerald-400' };
}

function StatusDot({ status }: { status: 'ok' | 'running' | 'error' }) {
  const colors = {
    ok: 'bg-emerald-400 shadow-[0_0_6px_hsl(160_60%_50%/0.6)]',
    running: 'bg-warning animate-pulse shadow-[0_0_6px_hsl(38_92%_50%/0.6)]',
    error: 'bg-rose-400 shadow-[0_0_6px_hsl(350_70%_50%/0.6)]',
  };
  return <span className={cn('inline-block w-2.5 h-2.5 rounded-full', colors[status])} />;
}

// ─── Compact Incident Card ───────────────────────────────────────────────────
function IncidentCard({ insight, compact }: { insight: M365AnalyzerInsight; compact?: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const sev = SEVERITY_CONFIG[insight.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.medium;
  const isCritical = insight.severity === 'critical';
  const prevCount = (insight.metadata as any)?.previousCount;

  const tooltipText = insight.recommendation || insight.description || 'Sem informações adicionais';

  return (
    <>
      <Card className={cn(
        'glass-card border transition-all',
        sev.border,
        isCritical && sev.glow,
        isCritical && 'bg-rose-500/5',
      )}>
        <CardContent className={cn('space-y-1.5', compact ? 'p-2' : 'p-3')}>
          {/* Row 1: Name + severity badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <sev.icon className={cn('w-4 h-4 shrink-0', sev.text, isCritical && 'animate-pulse')} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h4 className="text-sm font-semibold text-foreground truncate cursor-default">{insight.name}</h4>
                  </TooltipTrigger>
                  {insight.description && (
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      {insight.description}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge variant="outline" className={cn(
              'shrink-0 border',
              sev.bg, sev.text, sev.border,
              isCritical ? 'text-sm font-bold' : 'text-[10px]',
            )}>
              {insight.severity}
            </Badge>
          </div>

          {/* Row 2: Compact metrics line */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {insight.count !== undefined && insight.count > 0 && (
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {insight.count} ocorrências
              </span>
            )}
            {insight.affectedUsers && insight.affectedUsers.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {insight.affectedUsers.length} usuário{insight.affectedUsers.length > 1 ? 's' : ''}
              </span>
            )}
            {prevCount !== undefined && insight.count !== undefined && (
              <span className={cn('flex items-center gap-0.5 font-medium',
                insight.count > prevCount ? 'text-rose-400' : insight.count < prevCount ? 'text-emerald-400' : 'text-muted-foreground'
              )}>
                {insight.count > prevCount ? <TrendingUp className="w-3 h-3" /> : insight.count < prevCount ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {insight.count > prevCount ? `+${insight.count - prevCount}` : insight.count < prevCount ? `${insight.count - prevCount}` : '='} vs anterior
              </span>
            )}
            {prevCount === undefined && insight.count !== undefined && insight.count > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4">Novo</Badge>
            )}
            {/* Lightbulb tooltip - micro explanation */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-primary/70 cursor-help">
                    <Lightbulb className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Row 3: Only Details button */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={() => setDetailOpen(true)}>
              <Eye className="w-3 h-3" /> Detalhes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <IncidentDetailSheet insight={insight} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

// ─── Ranking List ────────────────────────────────────────────────────────────
function RankingList({ items, labelKey, periodLabel }: { items: { [key: string]: any; count: number }[]; labelKey: string; periodLabel?: string }) {
  if (!items?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>;
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-1">
      {periodLabel && (
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{periodLabel}</span>
        </div>
      )}
      {items.slice(0, 8).map((item, i) => (
        <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{item[labelKey]}</span>
            <Badge variant="secondary" className="font-mono text-xs shrink-0">{item.count}</Badge>
          </div>
          <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
            <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${(item.count / maxCount) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Severity Column ─────────────────────────────────────────────────────────
function SeverityColumn({ severity, incidents, compact }: {
  severity: 'critical' | 'high' | 'medium';
  incidents: M365AnalyzerInsight[];
  compact?: boolean;
}) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <div className="space-y-2">
      <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg', cfg.bg)}>
        <cfg.icon className={cn('w-4 h-4', cfg.text)} />
        <span className={cn('text-sm font-bold', cfg.text)}>{cfg.label}</span>
        <Badge variant="outline" className={cn('ml-auto text-[10px]', cfg.text, cfg.border)}>{incidents.length}</Badge>
      </div>
      {incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">—</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((ins, i) => (
            <IncidentCard key={ins.id || i} insight={ins} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function M365AnalyzerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [kpiFilter, setKpiFilter] = useState<KPIFilterKey | null>(null);
  const [activeTab, setActiveTab] = useState('incidents');

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();
  const { data: snapshot, isLoading, refetch } = useLatestM365AnalyzerSnapshot(selectedTenantId || undefined);
  const { data: diff } = useM365AnalyzerDiff(selectedTenantId || undefined, snapshot);
  const { data: progress, refetch: refetchProgress, isFetching: isRefetchingProgress } = useM365AnalyzerProgress(selectedTenantId || undefined);
  const isRunning = progress?.status === 'pending' || progress?.status === 'processing';
  const wasOrphan = (progress as any)?.wasOrphan === true;
  const lastFailed = progress?.status === 'failed';

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<string>('hourly');
  const [scheduleHour, setScheduleHour] = useState<number>(0);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleActive, setScheduleActive] = useState<boolean>(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // Auto-refresh when analysis finishes
  const prevProgressStatus = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = progress?.status ?? null;
    if (
      (currentStatus === 'completed' || currentStatus === 'failed') &&
      prevProgressStatus.current &&
      prevProgressStatus.current !== 'completed' &&
      prevProgressStatus.current !== 'failed'
    ) {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['m365-analyzer-latest', selectedTenantId] });
    }
    prevProgressStatus.current = currentStatus;
  }, [progress?.status, selectedTenantId]);

  // Schedule query
  const { data: currentSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['m365-analyzer-schedule', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;
      const { data } = await supabase
        .from('m365_analyzer_schedules')
        .select('*')
        .eq('tenant_record_id', selectedTenantId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!selectedTenantId && isSuperRole,
  });

  useEffect(() => {
    if (currentSchedule && scheduleDialogOpen) {
      setScheduleFreq(currentSchedule.frequency ?? 'hourly');
      setScheduleHour(currentSchedule.scheduled_hour ?? 0);
      setScheduleDayOfWeek(currentSchedule.scheduled_day_of_week ?? 1);
      setScheduleDayOfMonth(currentSchedule.scheduled_day_of_month ?? 1);
      setScheduleActive(currentSchedule.is_active ?? true);
    }
  }, [currentSchedule, scheduleDialogOpen]);

  function calculateNextRun(freq: string, hour: number, dayOfWeek: number, dayOfMonth: number): Date {
    const now = new Date();
    const next = new Date();
    if (freq === 'hourly') {
      next.setMinutes(0, 0, 0);
      next.setTime(next.getTime() + 60 * 60 * 1000);
    } else {
      next.setMinutes(0, 0, 0);
      next.setHours(hour);
      if (freq === 'daily') {
        if (next <= now) next.setDate(next.getDate() + 1);
      } else if (freq === 'weekly') {
        const currentDay = now.getDay();
        let diff = dayOfWeek - currentDay;
        if (diff < 0 || (diff === 0 && next <= now)) diff += 7;
        next.setDate(now.getDate() + diff);
      } else if (freq === 'monthly') {
        next.setDate(dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(dayOfMonth);
        }
      }
    }
    return next;
  }

  const handleSaveSchedule = async () => {
    if (!selectedTenantId) return;
    setScheduleSaving(true);
    try {
      const nextRunAt = calculateNextRun(scheduleFreq, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth);
      const { error } = await supabase
        .from('m365_analyzer_schedules')
        .upsert({
          tenant_record_id: selectedTenantId,
          frequency: scheduleFreq as any,
          scheduled_hour: scheduleHour,
          scheduled_day_of_week: scheduleDayOfWeek,
          scheduled_day_of_month: scheduleDayOfMonth,
          is_active: scheduleActive,
          next_run_at: nextRunAt.toISOString(),
        }, { onConflict: 'tenant_record_id' });
      if (error) throw error;
      sonnerToast.success('Agendamento salvo com sucesso!');
      await refetchSchedule();
      setScheduleDialogOpen(false);
    } catch (e: any) {
      sonnerToast.error('Erro ao salvar agendamento', { description: e.message });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTrigger = async () => {
    if (!selectedTenantId) return;
    setTriggering(true);
    try {
      const res = await supabase.functions.invoke('trigger-m365-analyzer', {
        body: { tenant_record_id: selectedTenantId },
      });
      const body = res.data;
      if (res.error || (body && !body.success)) {
        const msg = body?.error || res.error?.message || 'Falha ao disparar análise';
        if (body?.code === 'ALREADY_RUNNING' || msg.includes('andamento')) {
          toast({ title: 'Análise já em andamento', description: 'Aguarde a conclusão da análise atual.' });
        } else {
          toast({ title: 'Erro', description: msg, variant: 'destructive' });
        }
        return;
      }
      toast({ title: 'Análise iniciada', description: 'A coleta de dados M365 será processada em breve.' });
      setTimeout(() => { refetch(); refetchProgress(); }, 5000);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao disparar análise', variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_m365')) { navigate('/modules'); }
  }, [user, authLoading, navigate, hasModuleAccess]);

  if (authLoading) return null;

  // ─── Derived data ────────────────────────────────────────────────────────
  const m = snapshot?.metrics;

  // Filter insights: operational only + remove configurational items
  const operationalInsights = (snapshot?.insights ?? [])
    .filter(i => OPERATIONAL_CATEGORIES.includes(i.category as M365AnalyzerCategory))
    .filter(i => !isConfigurationalInsight(i));

  // Compute risk score from insights when backend doesn't provide one
  const computeRiskScore = (insights: typeof operationalInsights): number => {
    const weights: Record<string, number> = { critical: 15, high: 8, medium: 3, low: 1 };
    const total = insights.reduce((sum, i) => sum + (weights[i.severity] ?? 0), 0);
    return Math.min(100, total);
  };

  const score = snapshot?.score || computeRiskScore(operationalInsights);
  const risk = riskLevel(score);

  // KPI filter mapping
  const KPI_FILTER_MAP: Record<KPIFilterKey, (i: M365AnalyzerInsight) => boolean> = {
    highRiskSignIns: (i) => i.category === 'security_risk' && /risco|risk|sign.?in/i.test(i.name),
    mfaFailures: (i) => i.category === 'security_risk' && /mfa/i.test(i.name),
    impossibleTravel: (i) => i.category === 'security_risk' && /imposs|travel|geo|localiz/i.test(i.name),
    correlatedAlerts: (i) => i.category === 'account_compromise',
    suspiciousLogins: (i) => i.category === 'account_compromise' && /login|suspeito|suspicious/i.test(i.name),
    anomalousUsers: (i) => i.category === 'behavioral_baseline',
  };

  function applyKpiFilter(insights: M365AnalyzerInsight[]): M365AnalyzerInsight[] {
    if (!kpiFilter) return insights;
    const fn = KPI_FILTER_MAP[kpiFilter];
    return fn ? insights.filter(fn) : insights;
  }

  const anomalyInsights = applyKpiFilter(
    (snapshot?.insights ?? [])
      .filter(i => ANOMALY_CATEGORIES.includes(i.category as M365AnalyzerCategory))
      .filter(i => !isConfigurationalInsight(i))
  );

  // Group by severity for columns
  const criticalIncidents = applyKpiFilter(operationalInsights.filter(i => i.severity === 'critical'));
  const highIncidents = applyKpiFilter(operationalInsights.filter(i => i.severity === 'high'));
  const mediumIncidents = applyKpiFilter(operationalInsights.filter(i => i.severity === 'medium'));
  const totalIncidents = criticalIncidents.length + highIncidents.length + mediumIncidents.length;

  // Status dot
  const dotStatus: 'ok' | 'running' | 'error' = isRunning ? 'running' : lastFailed ? 'error' : 'ok';

  const pad = compactMode ? 'p-3' : 'p-4';

  // External movement data
  const { data: extMovementData } = useExternalMovementData(selectedTenantId || undefined);
  const extMovementCount = extMovementData?.totalAlerts ?? 0;
  const threatCount = (m?.threatProtection?.spamBlocked ?? 0) + (m?.threatProtection?.phishingDetected ?? 0) + (m?.threatProtection?.malwareBlocked ?? 0);

  // Threat dismissals
  const { dismissedKeys, dismiss: dismissThreat, restore: restoreThreat, isDismissing, isRestoring } = useThreatDismissals(selectedTenantId);

  return (
    <AppLayout>
      <div className={cn('p-6 lg:p-8 space-y-5', compactMode && 'space-y-3')}>
        <PageBreadcrumb items={[{ label: 'Microsoft 365' }, { label: 'Analyzer' }]} />

        {/* ═══ 1. HEADER ═══ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Radar className="w-6 h-6 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Radar de Incidentes</h1>
                <StatusDot status={dotStatus} />
              </div>
              <p className="text-muted-foreground text-sm">Monitoramento operacional · Microsoft 365</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <TenantSelector
              tenants={tenants}
              selectedId={selectedTenantId}
              onSelect={selectTenant}
              loading={tenantsLoading}
            />
            {snapshot && (
              <Badge variant="outline" className="text-xs gap-1.5">
                <Clock className="w-3 h-3" />
                {timeAgo(snapshot.created_at)}
              </Badge>
            )}
            <Button onClick={handleTrigger} disabled={triggering || !selectedTenantId || isRunning} size="sm">
              {isRunning
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Coletando...</>
                : <><Play className="w-4 h-4 mr-1.5" />{triggering ? 'Iniciando...' : 'Executar'}</>}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Configurar agendamento"
              disabled={!selectedTenantId}
              onClick={() => setScheduleDialogOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress card */}
        {isRunning && progress && (
          <Card className="glass-card border-primary/30">
            <CardContent className={pad}>
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Análise em andamento...</span>
                <div className="flex items-center gap-2 ml-auto">
                  {progress.elapsed !== null && (
                    <span className="text-xs text-muted-foreground">
                      {progress.status === 'pending' ? 'Aguardando coleta...' : 'Processando dados...'}
                      {' · '}
                      {Math.floor(progress.elapsed / 60) > 0
                        ? `${Math.floor(progress.elapsed / 60)}m ${progress.elapsed % 60}s`
                        : `${progress.elapsed}s`}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-primary hover:text-primary/80"
                    onClick={() => refetchProgress()}
                    disabled={isRefetchingProgress}
                  >
                    <Loader2 className={cn('w-3 h-3', isRefetchingProgress && 'animate-spin')} />
                    Atualizar
                  </Button>
                </div>
              </div>
              <Progress value={progress.status === 'pending' ? 15 : 60} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Failed/orphan state warning */}
        {lastFailed && !isRunning && (
          <Card className="glass-card border-destructive/30">
            <CardContent className={pad}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {wasOrphan
                    ? 'Última execução falhou (timeout na coleta). Dados exibidos são da coleta anterior.'
                    : 'Última execução falhou.'}
                </span>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={handleTrigger} disabled={triggering}>
                  <Play className="w-3 h-3 mr-1" /> Re-executar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ 2. RISCO ATUAL (textual) ═══ */}
        {snapshot && (
          <Card className={cn(
            'glass-card border-primary/20',
            score > 70 && 'border-rose-500/30 shadow-[0_0_20px_hsl(350_70%_50%/0.1)]',
          )}>
            <CardContent className={cn('flex flex-col md:flex-row md:items-center gap-4', compactMode ? 'p-3' : 'p-4')}>
              {/* Risk label */}
              <div className="flex items-center gap-3">
                <ShieldAlert className={cn('w-6 h-6', risk.color)} />
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Risco Atual</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xl font-bold', risk.color)}>{risk.label}</span>
                    <span className="text-lg text-muted-foreground font-mono">{score}/100</span>
                  </div>
                </div>
              </div>

              {/* Severity counters */}
              <div className="flex items-center gap-3 flex-wrap md:ml-auto">
                {(['critical', 'high', 'medium'] as const).map(sev => {
                  const cfg = SEVERITY_CONFIG[sev];
                  const counts = { critical: criticalIncidents.length, high: highIncidents.length, medium: mediumIncidents.length };
                  return (
                    <div key={sev} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md border', cfg.bg, cfg.border)}>
                      <cfg.icon className={cn('w-4 h-4', cfg.text)} />
                      <span className={cn('text-lg font-bold', cfg.text)}>{counts[sev]}</span>
                      <span className={cn('text-xs', cfg.text)}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Period metadata */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground md:ml-4">
                {snapshot.period_start && snapshot.period_end && (
                  <span>
                    {formatShortDateTimeBR(snapshot.period_start)}
                    {' → '}
                    {formatShortDateTimeBR(snapshot.period_end)}
                  </span>
                )}
                {(snapshot as any).snapshotCount && (
                  <Badge variant="secondary" className="text-[10px]">{(snapshot as any).snapshotCount} coletas</Badge>
                )}
              </div>
            </CardContent>
            {/* Sparkline de tendência */}
            {(snapshot as any).scoreHistory?.length >= 2 && (
              <div className="px-4 pb-3">
                <AnalyzerScoreSparkline data={(snapshot as any).scoreHistory} />
              </div>
            )}
          </Card>
        )}

        {/* KPI Cards — only for incidents/anomalies tabs */}
        {snapshot && m && (activeTab === 'incidents' || activeTab === 'anomalies') && (
          <AnalyzerKPIRow metrics={m} activeFilter={kpiFilter} onFilter={setKpiFilter} />
        )}

        {/* Diff Banner */}
        {diff && (diff.newCount > 0 || diff.resolvedCount > 0 || diff.escalatedCount > 0) && (
          <SnapshotDiffBanner diff={diff} />
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          </div>
        )}

        {/* ═══ 3-5. TABS: Incidentes / Anomalias / Movimento Externo ═══ */}
        {snapshot && (
          <>
            {kpiFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 text-xs">
                  <Search className="w-3 h-3" />
                  Filtro ativo
                </Badge>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setKpiFilter(null)}>
                  Limpar
                </Button>
              </div>
            )}
          <Tabs defaultValue="incidents" className="w-full" onValueChange={(v) => { setActiveTab(v); setKpiFilter(null); }}>
            <TabsList className="mb-4">
              <TabsTrigger value="incidents" className="gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Incidentes
                {totalIncidents > 0 && <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">{totalIncidents}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="anomalies" className="gap-1.5">
                <Activity className="w-4 h-4" />
                Anomalias
                {anomalyInsights.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">{anomalyInsights.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="protection" className="gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Proteção
                {threatCount > 0 && <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">{threatCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="external" className="gap-1.5">
                <ExternalLink className="w-4 h-4" />
                Movimento Externo
                {extMovementCount > 0 && <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">{extMovementCount}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Tab: Incidentes - 3 severity columns */}
            <TabsContent value="incidents">
              {totalIncidents === 0 ? (
                <Card className="glass-card border-emerald-500/20">
                  <CardContent className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                    <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum incidente ativo</h3>
                    <p className="text-xs text-muted-foreground">Nenhum evento operacional crítico detectado no período.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SeverityColumn severity="critical" incidents={criticalIncidents} compact={compactMode} />
                  <SeverityColumn severity="high" incidents={highIncidents} compact={compactMode} />
                  <SeverityColumn severity="medium" incidents={mediumIncidents} compact={compactMode} />
                </div>
              )}
            </TabsContent>

            {/* Tab: Anomalias */}
            <TabsContent value="anomalies">
              {anomalyInsights.length === 0 ? (
                <Card className="glass-card border-emerald-500/20">
                  <CardContent className="py-8 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                    <h3 className="text-sm font-semibold text-foreground mb-1">Sem anomalias recentes</h3>
                    <p className="text-xs text-muted-foreground">Nenhum desvio comportamental detectado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className={cn('grid gap-2', compactMode ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 gap-3')}>
                  {anomalyInsights.map((insight, i) => (
                    <IncidentCard key={insight.id || i} insight={insight} compact={compactMode} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab: Proteção contra Ameaças */}
            <TabsContent value="protection">
              {m && <ThreatProtectionTab metrics={m} insights={snapshot?.insights ?? []} compact={compactMode} dismissedKeys={dismissedKeys} onDismiss={dismissThreat} onRestore={restoreThreat} isDismissing={isDismissing} isRestoring={isRestoring} />}
            </TabsContent>

            {/* Tab: Movimento Externo */}
            <TabsContent value="external">
              <ExternalMovementTab tenantRecordId={selectedTenantId || undefined} compact={compactMode} />
            </TabsContent>
          </Tabs>
          </>
        )}

        {/* Empty state */}
        {!isLoading && !snapshot && selectedTenantId && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-10 text-center max-w-md mx-auto">
              <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
              <p className="text-sm text-muted-foreground mb-5">Execute a primeira análise para ativar o radar de incidentes.</p>
              <Button onClick={handleTrigger} disabled={triggering}>
                <Play className="w-4 h-4 mr-2" /> Executar Análise
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══ SCHEDULE DIALOG ═══ */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Agendamento</DialogTitle>
              <DialogDescription>Configure a frequência de execução automática do M365 Analyzer.</DialogDescription>
            </DialogHeader>
            <Alert className="border-blue-500/30 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm text-muted-foreground">
                O radar funciona melhor com coletas a cada hora. Recomendamos frequência horária.
              </AlertDescription>
            </Alert>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={scheduleActive} onCheckedChange={setScheduleActive} />
              </div>
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Por Hora</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scheduleFreq !== 'hourly' && (
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Select value={String(scheduleHour)} onValueChange={v => setScheduleHour(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scheduleFreq === 'weekly' && (
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select value={String(scheduleDayOfWeek)} onValueChange={v => setScheduleDayOfWeek(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {scheduleFreq === 'monthly' && (
                <div className="space-y-2">
                  <Label>Dia do Mês</Label>
                  <Select value={String(scheduleDayOfMonth)} onValueChange={v => setScheduleDayOfMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSchedule} disabled={scheduleSaving}>
                {scheduleSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
