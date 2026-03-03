import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Search, CheckCircle, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Timer, RefreshCw, Shield, Globe, Crosshair, Database, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCVESources } from '@/hooks/useCVECache';

// ── Shared renderer ──
function renderNextRunShared(nextRunAt: string | null) {
  if (!nextRunAt) return <span className="text-muted-foreground">—</span>;
  const next = new Date(nextRunAt);
  const now = new Date();
  const diffMin = differenceInMinutes(next, now);
  if (diffMin < 0) return <span className="text-muted-foreground">Atrasado</span>;
  const relative = formatDistanceToNow(next, { addSuffix: true, locale: ptBR });
  if (diffMin < 60) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-emerald-400 font-medium">{relative}</span>
      </div>
    );
  }
  return <span className="text-foreground">{relative}</span>;
}

// ── Unified type ──

interface UnifiedSchedule {
  id: string;
  targetId: string;
  targetName: string;
  targetType: 'firewall' | 'external_domain' | 'attack_surface' | 'firewall_analyzer' | 'm365_compliance';
  frequency: string;
  isActive: boolean;
  nextRunAt: string | null;
  scheduledHour: number | null;
  scheduledDayOfWeek: number | null;
  scheduledDayOfMonth: number | null;
  clientId: string;
  clientName: string;
  lastScore: number | null;
}

interface TaskRow {
  target_id: string;
  status: string;
  completed_at: string | null;
}

// ── Constants ──

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  hourly: 'Por Hora',
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  hourly: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ── Helpers ──

function getScoreColor(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 90) return 'bg-primary/15 text-primary border-primary/30';
  if (score >= 75) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
}

function getScheduleDescription(s: UnifiedSchedule) {
  const hour = s.scheduledHour ?? 0;
  const timeStr = `${String(hour).padStart(2, '0')}:00`;

  switch (s.frequency) {
    case 'hourly':
      return 'A cada hora';
    case 'daily':
      return `Todos os dias às ${timeStr}`;
    case 'weekly': {
      const day = DAY_NAMES[s.scheduledDayOfWeek ?? 1] || 'Segunda';
      return `${day} às ${timeStr}`;
    }
    case 'monthly': {
      const dom = s.scheduledDayOfMonth ?? 1;
      return `Dia ${dom} às ${timeStr}`;
    }
    default:
      return timeStr;
  }
}

// ── Component ──

export default function SchedulesPage() {
  const [search, setSearch] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Force re-render of relative time strings every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch firewall schedules ──
  const { data: firewallSchedules, isLoading: loadingFw, refetch: refetchFw } = useQuery({
    queryKey: ['admin-schedules-fw'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_schedules')
        .select('id, firewall_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, firewalls(id, name, last_score, client_id, clients(id, name))')
        .order('next_run_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((s): UnifiedSchedule => ({
        id: s.id,
        targetId: s.firewall_id,
        targetName: s.firewalls?.name || '—',
        targetType: 'firewall',
        frequency: s.frequency,
        isActive: s.is_active,
        nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour,
        scheduledDayOfWeek: s.scheduled_day_of_week,
        scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.firewalls?.clients?.id || '',
        clientName: s.firewalls?.clients?.name || '—',
        lastScore: s.firewalls?.last_score ?? null,
      }));
    },
  });

  // ── Fetch external domain schedules ──
  const { data: domainSchedules, isLoading: loadingDom, refetch: refetchDom } = useQuery({
    queryKey: ['admin-schedules-dom'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_domain_schedules')
        .select('id, domain_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, external_domains(id, name, last_score, client_id, clients(id, name))')
        .order('next_run_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((s): UnifiedSchedule => ({
        id: s.id,
        targetId: s.domain_id,
        targetName: s.external_domains?.name || '—',
        targetType: 'external_domain',
        frequency: s.frequency,
        isActive: s.is_active,
        nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour,
        scheduledDayOfWeek: s.scheduled_day_of_week,
        scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.external_domains?.clients?.id || '',
        clientName: s.external_domains?.clients?.name || '—',
        lastScore: s.external_domains?.last_score ?? null,
      }));
    },
  });

  // ── Fetch attack surface schedules ──
  const { data: attackSurfaceSchedules, isLoading: loadingAs, refetch: refetchAs } = useQuery({
    queryKey: ['admin-schedules-as'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attack_surface_schedules')
        .select('id, client_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, clients(id, name)')
        .order('next_run_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((s): UnifiedSchedule => ({
        id: s.id,
        targetId: s.client_id,
        targetName: s.clients?.name || '—',
        targetType: 'attack_surface',
        frequency: s.frequency,
        isActive: s.is_active ?? true,
        nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour,
        scheduledDayOfWeek: s.scheduled_day_of_week,
        scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.client_id,
        clientName: s.clients?.name || '—',
        lastScore: null,
      }));
    },
  });

  // ── Fetch analyzer schedules ──
  const { data: analyzerSchedules, isLoading: loadingAn, refetch: refetchAn } = useQuery({
    queryKey: ['admin-schedules-an'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analyzer_schedules')
        .select('id, firewall_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, firewalls(id, name, last_score, client_id, clients(id, name))')
        .order('next_run_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((s): UnifiedSchedule => ({
        id: s.id,
        targetId: s.firewall_id,
        targetName: s.firewalls?.name || '—',
        targetType: 'firewall_analyzer',
        frequency: s.frequency,
        isActive: s.is_active,
        nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour,
        scheduledDayOfWeek: s.scheduled_day_of_week,
        scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.firewalls?.clients?.id || '',
        clientName: s.firewalls?.clients?.name || '—',
        lastScore: s.firewalls?.last_score ?? null,
      }));
    },
  });

  // ── Fetch M365 compliance schedules ──
  const { data: m365Schedules, isLoading: loadingM365, refetch: refetchM365 } = useQuery({
    queryKey: ['admin-schedules-m365'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_analyzer_schedules')
        .select('id, tenant_record_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, m365_tenants(id, display_name, client_id, clients(id, name))')
        .order('next_run_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((s): UnifiedSchedule => ({
        id: s.id,
        targetId: s.tenant_record_id,
        targetName: s.m365_tenants?.display_name || '—',
        targetType: 'm365_compliance',
        frequency: s.frequency,
        isActive: s.is_active,
        nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour,
        scheduledDayOfWeek: s.scheduled_day_of_week,
        scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.m365_tenants?.clients?.id || '',
        clientName: s.m365_tenants?.clients?.name || '—',
        lastScore: null,
      }));
    },
  });

  const isLoading = loadingFw || loadingDom || loadingAs || loadingAn || loadingM365;

  const schedules = useMemo(() => {
    const all = [...(firewallSchedules || []), ...(domainSchedules || []), ...(attackSurfaceSchedules || []), ...(analyzerSchedules || []), ...(m365Schedules || [])];
    return all.sort((a, b) => {
      if (!a.nextRunAt && !b.nextRunAt) return 0;
      if (!a.nextRunAt) return 1;
      if (!b.nextRunAt) return -1;
      return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
    });
  }, [firewallSchedules, domainSchedules, attackSurfaceSchedules, analyzerSchedules, m365Schedules]);

  // ── Fetch latest task per target ──
  const targetIds = useMemo(() => schedules.map(s => s.targetId), [schedules]);

  const { data: latestTasks } = useQuery({
    queryKey: ['admin-schedule-tasks', targetIds],
    enabled: targetIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('target_id, status, completed_at')
        .in('target_id', targetIds)
        .in('target_type', ['firewall', 'external_domain', 'm365_compliance'])
        .order('completed_at', { ascending: false });
      if (error) throw error;
      const map = new Map<string, TaskRow>();
      for (const task of (data || []) as TaskRow[]) {
        if (!map.has(task.target_id)) {
          map.set(task.target_id, task);
        }
      }
      return map;
    },
  });

  // ── Stats ──
  const stats = useMemo(() => {
    if (!schedules.length) return { active: 0, next1h: 0, next6h: 0, next24h: 0, failed: 0 };
    const now = new Date();
    let active = 0, next1h = 0, next6h = 0, next24h = 0, failed = 0;
    for (const s of schedules) {
      if (s.isActive) active++;
      if (s.nextRunAt) {
        const diff = differenceInHours(new Date(s.nextRunAt), now);
        if (diff >= 0 && diff < 1) next1h++;
        if (diff >= 0 && diff < 6) next6h++;
        if (diff >= 0 && diff < 24) next24h++;
      }
      const task = latestTasks?.get(s.targetId);
      if (task && task.status === 'failed') failed++;
    }
    return { active, next1h, next6h, next24h, failed };
  }, [schedules, latestTasks]);

  // ── Filter & search ──
  const filtered = useMemo(() => {
    return schedules.filter(s => {
      if (search && !s.targetName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterWorkspace !== 'all' && s.clientId !== filterWorkspace) return false;
      if (filterFrequency !== 'all' && s.frequency !== filterFrequency) return false;
      if (filterType !== 'all' && s.targetType !== filterType) return false;
      return true;
    });
  }, [schedules, search, filterWorkspace, filterFrequency, filterType]);

  // ── Workspaces for filter ──
  const workspaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (s.clientId) map.set(s.clientId, s.clientName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [schedules]);

  // ── Renderers ──

  const renderNextRun = renderNextRunShared;

  const renderTaskStatus = (targetId: string) => {
    const task = latestTasks?.get(targetId);
    if (!task) {
      return (
        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border gap-1">
          <MinusCircle className="w-3 h-3" />
          Sem execução
        </Badge>
      );
    }
    if (task.status === 'completed') {
      return (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle className="w-3 h-3" />
          Sucesso
        </Badge>
      );
    }
    if (task.status === 'failed' || task.status === 'timeout') {
      return (
        <Badge variant="outline" className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1">
          <XCircle className="w-3 h-3" />
          Falhou
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1">
        <Timer className="w-3 h-3" />
        {task.status === 'running' ? 'Executando' : 'Pendente'}
      </Badge>
    );
  };

  const renderTypeBadge = (type: UnifiedSchedule['targetType']) => {
    if (type === 'firewall') {
      return (
        <Badge variant="outline" className="bg-orange-500/15 text-orange-400 border-orange-500/30 gap-1">
          <Shield className="w-3 h-3" />
          Firewall Compliance
        </Badge>
      );
    }
    if (type === 'attack_surface') {
      return (
        <Badge variant="outline" className="bg-violet-500/15 text-violet-400 border-violet-500/30 gap-1">
          <Crosshair className="w-3 h-3" />
          Surface Analyzer
        </Badge>
      );
    }
    if (type === 'firewall_analyzer') {
      return (
        <Badge variant="outline" className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1">
          <Activity className="w-3 h-3" />
          Firewall Analyzer
        </Badge>
      );
    }
    if (type === 'm365_compliance') {
      return (
        <Badge variant="outline" className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 gap-1">
          <Database className="w-3 h-3" />
          M365 Compliance
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 gap-1">
        <Globe className="w-3 h-3" />
        Domain Compliance
      </Badge>
    );
  };

  const handleRefresh = () => {
    refetchFw();
    refetchDom();
    refetchAs();
    refetchAn();
    refetchM365();
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Administração' },
            { label: 'Agendamentos' },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
            <p className="text-muted-foreground">Painel centralizado de agendamentos de análise</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.active}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.next1h}</p>
                  <p className="text-xs text-muted-foreground">Próx. 1h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.next6h}</p>
                  <p className="text-xs text-muted-foreground">Próx. 6h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.next24h}</p>
                  <p className="text-xs text-muted-foreground">Próx. 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Com falha</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ativo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="firewall">Firewall Compliance</SelectItem>
              <SelectItem value="external_domain">Domain Compliance</SelectItem>
              <SelectItem value="attack_surface">Surface Analyzer</SelectItem>
              <SelectItem value="firewall_analyzer">Firewall Analyzer</SelectItem>
              <SelectItem value="m365_compliance">M365 Compliance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterWorkspace} onValueChange={setFilterWorkspace}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Workspace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os workspaces</SelectItem>
              {workspaces.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFrequency} onValueChange={setFilterFrequency}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="hourly">Por Hora</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum agendamento encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Programação</TableHead>
                    <TableHead>Próxima Execução</TableHead>
                    <TableHead>Último Score</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(schedule => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        {renderTypeBadge(schedule.targetType)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {schedule.targetName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {schedule.clientName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={FREQUENCY_COLORS[schedule.frequency] || ''}>
                          {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getScheduleDescription(schedule)}
                      </TableCell>
                      <TableCell>
                        {renderNextRun(schedule.nextRunAt)}
                      </TableCell>
                      <TableCell>
                        {schedule.lastScore !== null && schedule.lastScore !== undefined ? (
                          <Badge variant="outline" className={getScoreColor(schedule.lastScore)}>
                            {schedule.lastScore}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderTaskStatus(schedule.targetId)}
                      </TableCell>
                      <TableCell>
                        {schedule.isActive ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* CVE Sources Sync Section */}
        <CVESourcesSection />
      </div>
    </AppLayout>
  );
}

// ── CVE Sources constants ──

const CVE_MODULE_LABELS: Record<string, string> = {
  firewall: 'Firewall',
  m365: 'Microsoft 365',
  external_domain: 'Dom. Externo',
};

const CVE_MODULE_COLORS: Record<string, string> = {
  firewall: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  m365: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  external_domain: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const CVE_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  success: { icon: CheckCircle2, label: 'OK', className: 'text-emerald-400' },
  error: { icon: XCircle, label: 'Erro', className: 'text-rose-400' },
  syncing: { icon: RefreshCw, label: 'Sincronizando', className: 'text-blue-400 animate-spin' },
  pending: { icon: Clock, label: 'Pendente', className: 'text-muted-foreground' },
};

function CVESourcesSection() {
  const { data: sources, isLoading } = useCVESources();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Sincronização de CVEs</h2>
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!sources || sources.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Sincronização de CVEs</h2>
        <span className="text-sm text-muted-foreground">({sources.length} fontes)</span>
      </div>
      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Sync</TableHead>
                <TableHead>Próxima Execução</TableHead>
                <TableHead className="text-right">CVEs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map(source => {
                const statusCfg = CVE_STATUS_CONFIG[source.last_sync_status || 'pending'] || CVE_STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isPartial = source.last_sync_error?.toLowerCase().includes('parcial');

                return (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium text-foreground">
                      {source.source_label}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-xs', CVE_MODULE_COLORS[source.module_code] || '')}>
                        {CVE_MODULE_LABELS[source.module_code] || source.module_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={cn('w-4 h-4', statusCfg.className)} />
                        <span className="text-sm text-muted-foreground">{statusCfg.label}</span>
                        {isPartial && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30 px-1.5 py-0">
                            parcial
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {source.last_sync_at
                        ? formatDistanceToNow(new Date(source.last_sync_at), { addSuffix: true, locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {renderNextRunShared(source.next_run_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {source.last_sync_count || 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
