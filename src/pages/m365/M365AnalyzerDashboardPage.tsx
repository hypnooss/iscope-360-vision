import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { useLatestM365AnalyzerSnapshot, useM365AnalyzerProgress } from '@/hooks/useM365AnalyzerData';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, AlertOctagon, Info, Play,
  Mail, Users, Lock, ExternalLink, FileWarning,
  Clock, Settings, Loader2, Activity, Database,
  Inbox, UserX, Send, ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import {
  M365_ANALYZER_CATEGORIES,
  M365_ANALYZER_CATEGORY_LABELS,
  groupM365AnalyzerInsightsByCategory,
  type M365AnalyzerCategory,
  type M365AnalyzerInsight,
} from '@/types/m365AnalyzerInsights';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-warning/10 text-warning border-warning/30',
  low: 'bg-primary/10 text-primary border-primary/30',
  info: 'bg-muted text-muted-foreground border-muted',
};

const CATEGORY_ICONS: Record<M365AnalyzerCategory, React.ComponentType<{ className?: string }>> = {
  phishing_threats: Mail,
  mailbox_capacity: Inbox,
  behavioral_baseline: Activity,
  account_compromise: UserX,
  suspicious_rules: FileWarning,
  exfiltration: Send,
  operational_risks: ShieldAlert,
};

function InsightCard({ insight }: { insight: M365AnalyzerInsight }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">{insight.name}</h4>
          <Badge variant="outline" className={cn('text-[10px] shrink-0 border', SEVERITY_COLORS[insight.severity])}>
            {insight.severity}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{insight.description}</p>
        {insight.affectedUsers && insight.affectedUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{insight.affectedUsers.slice(0, 3).join(', ')}{insight.affectedUsers.length > 3 ? ` +${insight.affectedUsers.length - 3}` : ''}</span>
          </div>
        )}
        {insight.recommendation && (
          <div className="text-xs text-primary/80 bg-primary/5 rounded p-2 mt-1">
            💡 {insight.recommendation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RankingList({ items, labelKey }: { items: { [key: string]: any; count: number }[]; labelKey: string }) {
  if (!items?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>;
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-1">
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

export default function M365AnalyzerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);

  const { tenants, selectedTenantId, selectTenant, loading: tenantsLoading } = useM365TenantSelector();

  const { data: snapshot, isLoading, refetch } = useLatestM365AnalyzerSnapshot(selectedTenantId || undefined);
  const { data: progress, refetch: refetchProgress, isFetching: isRefetchingProgress } = useM365AnalyzerProgress(selectedTenantId || undefined);
  const isRunning = progress?.status === 'pending' || progress?.status === 'processing';
  const isOrphan = (progress as any)?.reconciled === true;

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

  const severityCards = [
    { label: 'Critical', value: snapshot?.summary?.critical ?? 0, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', icon: AlertOctagon },
    { label: 'High', value: snapshot?.summary?.high ?? 0, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', icon: AlertTriangle },
    { label: 'Medium', value: snapshot?.summary?.medium ?? 0, color: 'text-warning bg-warning/10 border-warning/30', icon: Shield },
    { label: 'Low', value: snapshot?.summary?.low ?? 0, color: 'text-primary bg-primary/10 border-primary/30', icon: Info },
  ];

  const m = snapshot?.metrics;
  const groupedInsights = snapshot ? groupM365AnalyzerInsightsByCategory(snapshot.insights) : null;

  // Top risks: critical + high insights
  const topRisks = snapshot?.insights
    ?.filter(i => i.severity === 'critical' || i.severity === 'high')
    ?.slice(0, 10) ?? [];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Microsoft 365' }, { label: 'Analyzer' }]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">M365 Analyzer</h1>
            <p className="text-muted-foreground">Inteligência de segurança para Microsoft 365</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <TenantSelector
              tenants={tenants}
              selectedId={selectedTenantId}
              onSelect={selectTenant}
              loading={tenantsLoading}
            />
            <Button onClick={handleTrigger} disabled={triggering || !selectedTenantId || isRunning}>
              {isRunning
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Em andamento...</>
                : <><Play className="w-4 h-4 mr-2" />{triggering ? 'Iniciando...' : 'Executar Análise'}</>}
            </Button>
            {isSuperRole && (
              <Button
                variant="outline"
                size="icon"
                title="Configurar agendamento"
                disabled={!selectedTenantId}
                onClick={() => setScheduleDialogOpen(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress card */}
        {isRunning && progress && (
          <Card className="glass-card border-primary/30">
            <CardContent className="p-4">
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

        {/* Orphan state warning */}
        {isOrphan && (
          <Card className="glass-card border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Execução anterior encerrada com inconsistência.</span>
                <span className="text-xs text-muted-foreground">A próxima execução irá reconciliar automaticamente.</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-xs"
                  onClick={handleTrigger}
                  disabled={triggering}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Re-executar Análise
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Last analysis info */}
        {snapshot && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última coleta:</span>
            <Badge variant="outline" className="text-xs">
              {new Date(snapshot.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {snapshot.period_start && snapshot.period_end && (
              <>
                <span className="text-sm text-muted-foreground">Período:</span>
                <Badge variant="outline" className="text-xs">
                  {new Date(snapshot.period_start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {new Date(snapshot.period_end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Badge>
              </>
            )}
            {(snapshot as any).snapshotCount && (
              <Badge variant="secondary" className="text-xs">
                {(snapshot as any).snapshotCount} coletas
              </Badge>
            )}
          </div>
        )}

        {/* Severity Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading
            ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : severityCards.map(c => (
                <Card key={c.label} className={cn('glass-card border', c.color)}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <c.icon className="w-8 h-8" />
                    <div>
                      <div className="text-2xl font-bold">{c.value}</div>
                      <div className="text-xs opacity-80">{c.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Metrics summary */}
        {snapshot && m && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4 text-primary" />
                Resumo de Métricas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.phishing?.totalBlocked ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Phishing Bloqueados</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Database className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.mailbox?.above90Pct ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Mailboxes &gt;90%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Activity className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.behavioral?.anomalousUsers ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Comportamentos Anômalos</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.compromise?.suspiciousLogins ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Logins Suspeitos</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <FileWarning className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.rules.externalForwards + m.rules.autoDelete}</div>
                    <div className="text-xs text-muted-foreground">Regras Suspeitas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <Send className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.exfiltration.highVolumeExternal}</div>
                    <div className="text-xs text-muted-foreground">Envios Externos Altos</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.operational.smtpAuthEnabled + m.operational.legacyProtocols}</div>
                    <div className="text-xs text-muted-foreground">Riscos Operacionais</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                  <UserX className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-foreground">{m.compromise.correlatedAlerts}</div>
                    <div className="text-xs text-muted-foreground">Alertas Correlacionados</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Risks */}
        {topRisks.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                Top Riscos Agora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topRisks.map((insight, i) => (
                <InsightCard key={insight.id || i} insight={insight} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Rankings */}
        {snapshot && m && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(m.phishing?.topAttackedUsers?.length ?? 0) > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Usuários Mais Atacados (Phishing)</CardTitle></CardHeader>
                <CardContent>
                  <RankingList items={m.phishing.topAttackedUsers} labelKey="user" />
                </CardContent>
              </Card>
            )}
            {(m.phishing?.topSenderDomains?.length ?? 0) > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Top Domínios Remetentes</CardTitle></CardHeader>
                <CardContent>
                  <RankingList items={m.phishing.topSenderDomains} labelKey="domain" />
                </CardContent>
              </Card>
            )}
            {(m.exfiltration?.topExternalDomains?.length ?? 0) > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Top Domínios Externos (Envio)</CardTitle></CardHeader>
                <CardContent>
                  <RankingList items={m.exfiltration.topExternalDomains} labelKey="domain" />
                </CardContent>
              </Card>
            )}
            {(m.compromise?.topRiskUsers?.length ?? 0) > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-sm">Usuários em Risco</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {m.compromise.topRiskUsers.slice(0, 8).map((u, i) => (
                      <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">{i + 1}</span>
                          <span className="text-sm font-medium text-foreground flex-1 truncate">{u.user}</span>
                        </div>
                        <div className="ml-8 mt-1 flex flex-wrap gap-1">
                          {u.reasons.map((r, j) => (
                            <Badge key={j} variant="outline" className="text-[10px]">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Category Tabs */}
        {groupedInsights && (
          <Tabs defaultValue="phishing_threats" className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {M365_ANALYZER_CATEGORIES.map(cat => {
                const Icon = CATEGORY_ICONS[cat];
                const count = groupedInsights[cat]?.length ?? 0;
                return (
                  <TabsTrigger key={cat} value={cat} className="flex items-center gap-1.5 data-[state=active]:bg-secondary">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{M365_ANALYZER_CATEGORY_LABELS[cat]}</span>
                    {count > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{count}</Badge>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {M365_ANALYZER_CATEGORIES.map(cat => (
              <TabsContent key={cat} value={cat}>
                {groupedInsights[cat].length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Nenhum insight nesta categoria
                  </div>
                ) : (
                  <div className="grid gap-3 mt-4">
                    {groupedInsights[cat].map((insight, i) => (
                      <InsightCard key={insight.id || i} insight={insight} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Empty state */}
        {!isLoading && !snapshot && selectedTenantId && (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma análise encontrada</h3>
              <p className="text-muted-foreground mb-4">Execute a primeira análise para começar a monitorar seu ambiente M365.</p>
              <Button onClick={handleTrigger} disabled={triggering}>
                <Play className="w-4 h-4 mr-2" />Executar Primeira Análise
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Schedule Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Agendamento</DialogTitle>
              <DialogDescription>Configure a frequência de execução automática do M365 Analyzer.</DialogDescription>
            </DialogHeader>
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
