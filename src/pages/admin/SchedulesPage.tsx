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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Search, CheckCircle, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Timer, RefreshCw, Shield, Globe, Crosshair, Database, Activity, ListChecks, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInHours, differenceInMinutes, differenceInSeconds, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCVESources } from '@/hooks/useCVECache';

// ── Shared renderer ──
function renderNextRunShared(nextRunAt: string | null) {
  if (!nextRunAt) return <span className="text-muted-foreground">—</span>;
  const next = new Date(nextRunAt);
  const now = new Date();
  const diffMin = differenceInMinutes(next, now);
  if (diffMin < -5) return <span className="text-destructive font-medium">Atrasado ({Math.abs(diffMin)} min)</span>;
  if (diffMin < 0) {
    const relative = formatDistanceToNow(next, { addSuffix: true, locale: ptBR });
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <span className="text-amber-400 font-medium">Executando...</span>
      </div>
    );
  }
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
  targetType: 'firewall' | 'external_domain' | 'attack_surface' | 'firewall_analyzer' | 'm365_compliance' | 'm365_analyzer';
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

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const secs = differenceInSeconds(end, start);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

// ── Shared renderTypeBadge ──

type TargetType = 'firewall' | 'external_domain' | 'attack_surface' | 'firewall_analyzer' | 'm365_compliance' | 'm365_analyzer';

function renderTypeBadge(type: TargetType) {
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
  if (type === 'm365_analyzer') {
    return (
      <Badge variant="outline" className="bg-teal-500/15 text-teal-400 border-teal-500/30 gap-1">
        <Activity className="w-3 h-3" />
        M365 Analyzer
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 gap-1">
      <Globe className="w-3 h-3" />
      Domain Compliance
    </Badge>
  );
}

// ── Task type to target type mapping ──
const TASK_TYPE_TO_TARGET: Record<string, TargetType> = {
  fortigate_compliance: 'firewall',
  fortigate_analyzer: 'firewall_analyzer',
  external_domain_compliance: 'external_domain',
  m365_compliance: 'm365_compliance',
  m365_analyzer: 'm365_analyzer',
  attack_surface_scan: 'attack_surface',
};

function mapTaskType(taskType: string, targetType: string): TargetType {
  if (TASK_TYPE_TO_TARGET[taskType]) return TASK_TYPE_TO_TARGET[taskType];
  if (targetType === 'firewall') return 'firewall';
  if (targetType === 'external_domain') return 'external_domain';
  if (targetType === 'm365_tenant') return 'm365_analyzer';
  return 'firewall';
}

// ── Execution status config ──

const EXEC_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; label: string; badgeClass: string }> = {
  pending: { icon: Clock, label: 'Pendente', badgeClass: 'bg-muted/50 text-muted-foreground border-border' },
  running: { icon: Timer, label: 'Executando', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  completed: { icon: CheckCircle, label: 'Concluída', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed: { icon: XCircle, label: 'Falhou', badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  timeout: { icon: AlertTriangle, label: 'Timeout', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  cancelled: { icon: Ban, label: 'Cancelada', badgeClass: 'bg-muted/50 text-muted-foreground border-border' },
};

// ── Component ──

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState('schedules');

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
            <p className="text-muted-foreground">Painel centralizado de agendamentos e execuções</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="schedules" className="gap-2">
              <Calendar className="w-4 h-4" />
              Agendamentos
            </TabsTrigger>
            <TabsTrigger value="executions" className="gap-2">
              <ListChecks className="w-4 h-4" />
              Execuções
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="mt-6 space-y-6">
            <SchedulesTab />
          </TabsContent>

          <TabsContent value="executions" className="mt-6 space-y-6">
            <ExecutionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ══════════════════════════════════════════════════════
// ── Schedules Tab (existing content extracted) ──
// ══════════════════════════════════════════════════════

function SchedulesTab() {
  const [search, setSearch] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [filterType, setFilterType] = useState('all');

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
        id: s.id, targetId: s.firewall_id, targetName: s.firewalls?.name || '—', targetType: 'firewall',
        frequency: s.frequency, isActive: s.is_active, nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour, scheduledDayOfWeek: s.scheduled_day_of_week, scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.firewalls?.clients?.id || '', clientName: s.firewalls?.clients?.name || '—', lastScore: s.firewalls?.last_score ?? null,
      }));
    },
  });

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
        id: s.id, targetId: s.domain_id, targetName: s.external_domains?.name || '—', targetType: 'external_domain',
        frequency: s.frequency, isActive: s.is_active, nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour, scheduledDayOfWeek: s.scheduled_day_of_week, scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.external_domains?.clients?.id || '', clientName: s.external_domains?.clients?.name || '—', lastScore: s.external_domains?.last_score ?? null,
      }));
    },
  });

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
        id: s.id, targetId: s.client_id, targetName: s.clients?.name || '—', targetType: 'attack_surface',
        frequency: s.frequency, isActive: s.is_active ?? true, nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour, scheduledDayOfWeek: s.scheduled_day_of_week, scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.client_id, clientName: s.clients?.name || '—', lastScore: null,
      }));
    },
  });

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
        id: s.id, targetId: s.firewall_id, targetName: s.firewalls?.name || '—', targetType: 'firewall_analyzer',
        frequency: s.frequency, isActive: s.is_active, nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour, scheduledDayOfWeek: s.scheduled_day_of_week, scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.firewalls?.clients?.id || '', clientName: s.firewalls?.clients?.name || '—', lastScore: s.firewalls?.last_score ?? null,
      }));
    },
  });

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
        id: s.id, targetId: s.tenant_record_id, targetName: s.m365_tenants?.display_name || '—', targetType: 'm365_analyzer',
        frequency: s.frequency, isActive: s.is_active, nextRunAt: s.next_run_at,
        scheduledHour: s.scheduled_hour, scheduledDayOfWeek: s.scheduled_day_of_week, scheduledDayOfMonth: s.scheduled_day_of_month,
        clientId: s.m365_tenants?.clients?.id || '', clientName: s.m365_tenants?.clients?.name || '—', lastScore: null,
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
        .in('target_type', ['firewall', 'external_domain', 'm365_compliance', 'm365_tenant'])
        .order('completed_at', { ascending: false });
      if (error) throw error;
      const map = new Map<string, TaskRow>();
      for (const task of (data || []) as TaskRow[]) {
        if (!map.has(task.target_id)) map.set(task.target_id, task);
      }
      return map;
    },
  });

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

  const filtered = useMemo(() => {
    return schedules.filter(s => {
      if (search && !s.targetName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterWorkspace !== 'all' && s.clientId !== filterWorkspace) return false;
      if (filterFrequency !== 'all' && s.frequency !== filterFrequency) return false;
      if (filterType !== 'all' && s.targetType !== filterType) return false;
      return true;
    });
  }, [schedules, search, filterWorkspace, filterFrequency, filterType]);

  const workspaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (s.clientId) map.set(s.clientId, s.clientName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [schedules]);

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

  const handleRefresh = () => {
    refetchFw(); refetchDom(); refetchAs(); refetchAn(); refetchM365();
  };

  return (
    <>
      <div className="flex justify-end">
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
          <Input placeholder="Buscar ativo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="firewall">Firewall Compliance</SelectItem>
            <SelectItem value="external_domain">Domain Compliance</SelectItem>
            <SelectItem value="attack_surface">Surface Analyzer</SelectItem>
            <SelectItem value="firewall_analyzer">Firewall Analyzer</SelectItem>
            <SelectItem value="m365_compliance">M365 Compliance</SelectItem>
            <SelectItem value="m365_analyzer">M365 Analyzer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterWorkspace} onValueChange={setFilterWorkspace}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Workspace" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os workspaces</SelectItem>
            {workspaces.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterFrequency} onValueChange={setFilterFrequency}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Frequência" /></SelectTrigger>
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
                    <TableCell>{renderTypeBadge(schedule.targetType)}</TableCell>
                    <TableCell className="font-medium text-foreground">{schedule.targetName}</TableCell>
                    <TableCell className="text-muted-foreground">{schedule.clientName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={FREQUENCY_COLORS[schedule.frequency] || ''}>
                        {FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getScheduleDescription(schedule)}</TableCell>
                    <TableCell>{renderNextRunShared(schedule.nextRunAt)}</TableCell>
                    <TableCell>
                      {schedule.lastScore !== null && schedule.lastScore !== undefined ? (
                        <Badge variant="outline" className={getScoreColor(schedule.lastScore)}>{schedule.lastScore}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{renderTaskStatus(schedule.targetId)}</TableCell>
                    <TableCell>
                      {schedule.isActive ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">Inativo</Badge>
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
    </>
  );
}

// ══════════════════════════════════════════════════════
// ── Executions Tab (new) ──
// ══════════════════════════════════════════════════════

interface ExecutionRow {
  id: string;
  task_type: string;
  target_type: string;
  target_id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_id: string;
  error_message: string | null;
  // joined
  agent_name?: string;
  target_name?: string;
  client_id?: string;
  client_name?: string;
}

function ExecutionsTab() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterWorkspace, setFilterWorkspace] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [timeWindow, setTimeWindow] = useState('24h');

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Compute time cutoff
  const timeCutoff = useMemo(() => {
    const now = new Date();
    const hours: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
    const h = hours[timeWindow] || 24;
    return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
  }, [timeWindow]);

  // Fetch executions
  const { data: executions, isLoading, refetch } = useQuery({
    queryKey: ['admin-executions', timeCutoff],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('id, task_type, target_type, target_id, status, created_at, started_at, completed_at, agent_id, error_message, agents(name, client_id, clients(id, name))')
        .gte('created_at', timeCutoff)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Resolve target names - fetch firewalls, domains, tenants
  const targetIds = useMemo(() => {
    if (!executions) return { fw: [] as string[], dom: [] as string[], m365: [] as string[] };
    const fw = new Set<string>(), dom = new Set<string>(), m365 = new Set<string>();
    for (const e of executions) {
      if (e.target_type === 'firewall') fw.add(e.target_id);
      else if (e.target_type === 'external_domain') dom.add(e.target_id);
      else if (e.target_type === 'm365_tenant') m365.add(e.target_id);
    }
    return { fw: Array.from(fw), dom: Array.from(dom), m365: Array.from(m365) };
  }, [executions]);

  const { data: fwNames } = useQuery({
    queryKey: ['exec-fw-names', targetIds.fw],
    enabled: targetIds.fw.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('firewalls').select('id, name, client_id').in('id', targetIds.fw);
      return new Map((data || []).map(f => [f.id, { name: f.name, client_id: f.client_id }]));
    },
  });

  const { data: domNames } = useQuery({
    queryKey: ['exec-dom-names', targetIds.dom],
    enabled: targetIds.dom.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('external_domains').select('id, name, client_id').in('id', targetIds.dom);
      return new Map((data || []).map(d => [d.id, { name: d.name, client_id: d.client_id }]));
    },
  });

  const { data: m365Names } = useQuery({
    queryKey: ['exec-m365-names', targetIds.m365],
    enabled: targetIds.m365.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('m365_tenants').select('id, display_name, client_id').in('id', targetIds.m365);
      return new Map((data || []).map(t => [t.id, { name: t.display_name, client_id: t.client_id }]));
    },
  });

  // Build enriched rows
  const rows = useMemo((): ExecutionRow[] => {
    if (!executions) return [];
    return executions.map((e: any) => {
      let target_name = '—';
      let client_id = e.agents?.client_id || '';
      let client_name = e.agents?.clients?.name || '—';

      if (e.target_type === 'firewall' && fwNames?.has(e.target_id)) {
        const fw = fwNames.get(e.target_id)!;
        target_name = fw.name;
        client_id = fw.client_id || client_id;
      } else if (e.target_type === 'external_domain' && domNames?.has(e.target_id)) {
        const dom = domNames.get(e.target_id)!;
        target_name = dom.name;
        client_id = dom.client_id || client_id;
      } else if (e.target_type === 'm365_tenant' && m365Names?.has(e.target_id)) {
        const m = m365Names.get(e.target_id)!;
        target_name = m.name;
        client_id = m.client_id || client_id;
      }

      return {
        id: e.id,
        task_type: e.task_type,
        target_type: e.target_type,
        target_id: e.target_id,
        status: e.status,
        created_at: e.created_at,
        started_at: e.started_at,
        completed_at: e.completed_at,
        agent_id: e.agent_id,
        error_message: e.error_message,
        agent_name: e.agents?.name || '—',
        target_name,
        client_id,
        client_name,
      };
    });
  }, [executions, fwNames, domNames, m365Names]);

  // Stats
  const execStats = useMemo(() => {
    let total = 0, pending = 0, running = 0, completed = 0, failed = 0;
    for (const r of rows) {
      total++;
      if (r.status === 'pending') pending++;
      else if (r.status === 'running') running++;
      else if (r.status === 'completed') completed++;
      else if (r.status === 'failed' || r.status === 'timeout') failed++;
    }
    return { total, pending, running, completed, failed };
  }, [rows]);

  // Workspaces from rows
  const workspaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.client_id && r.client_name) map.set(r.client_id, r.client_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.target_name?.toLowerCase().includes(search.toLowerCase()) && !r.agent_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== 'all') {
        const mapped = mapTaskType(r.task_type, r.target_type);
        if (mapped !== filterType) return false;
      }
      if (filterWorkspace !== 'all' && r.client_id !== filterWorkspace) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterType, filterWorkspace, filterStatus]);

  const renderExecStatus = (status: string) => {
    const cfg = EXEC_STATUS_CONFIG[status] || EXEC_STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={cn(cfg.badgeClass, 'gap-1')}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListChecks className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : execStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : execStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Timer className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : execStats.running}</p>
                <p className="text-xs text-muted-foreground">Executando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : execStats.completed}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : execStats.failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar ativo ou agente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="firewall">Firewall Compliance</SelectItem>
            <SelectItem value="external_domain">Domain Compliance</SelectItem>
            <SelectItem value="attack_surface">Surface Analyzer</SelectItem>
            <SelectItem value="firewall_analyzer">Firewall Analyzer</SelectItem>
            <SelectItem value="m365_compliance">M365 Compliance</SelectItem>
            <SelectItem value="m365_analyzer">M365 Analyzer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterWorkspace} onValueChange={setFilterWorkspace}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Workspace" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os workspaces</SelectItem>
            {workspaces.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="running">Executando</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="timeout">Timeout</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeWindow} onValueChange={setTimeWindow}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Última 1h</SelectItem>
            <SelectItem value="6h">Últimas 6h</SelectItem>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7d</SelectItem>
            <SelectItem value="30d">Últimos 30d</SelectItem>
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
              Nenhuma execução encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>{renderTypeBadge(mapTaskType(row.task_type, row.target_type))}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.target_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.client_name}</TableCell>
                    <TableCell>{renderExecStatus(row.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.agent_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDuration(row.started_at, row.completed_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(row.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════
// ── CVE Sources Section ──
// ══════════════════════════════════════════════════════

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
                    <TableCell className="font-medium text-foreground">{source.source_label}</TableCell>
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
                    <TableCell>{renderNextRunShared(source.next_run_at)}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{source.last_sync_count || 0}</TableCell>
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
