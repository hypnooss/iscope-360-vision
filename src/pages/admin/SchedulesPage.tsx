import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Search, CheckCircle, XCircle, MinusCircle, AlertTriangle, Timer } from 'lucide-react';
import { formatDistanceToNow, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleRow {
  id: string;
  firewall_id: string;
  frequency: string;
  is_active: boolean;
  next_run_at: string | null;
  scheduled_hour: number | null;
  scheduled_day_of_week: number | null;
  scheduled_day_of_month: number | null;
  firewalls: {
    id: string;
    name: string;
    last_score: number | null;
    last_analysis_at: string | null;
    client_id: string;
    clients: {
      id: string;
      name: string;
    };
  };
}

interface TaskRow {
  target_id: string;
  status: string;
  completed_at: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getScoreColor(score: number | null) {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 90) return 'bg-primary/15 text-primary border-primary/30';
  if (score >= 75) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
}

function getScheduleDescription(schedule: ScheduleRow) {
  const hour = schedule.scheduled_hour ?? 0;
  const timeStr = `${String(hour).padStart(2, '0')}:00`;

  switch (schedule.frequency) {
    case 'daily':
      return `Todos os dias às ${timeStr}`;
    case 'weekly': {
      const day = DAY_NAMES[schedule.scheduled_day_of_week ?? 1] || 'Segunda';
      return `${day} às ${timeStr}`;
    }
    case 'monthly': {
      const dom = schedule.scheduled_day_of_month ?? 1;
      return `Dia ${dom} às ${timeStr}`;
    }
    default:
      return timeStr;
  }
}

export default function SchedulesPage() {
  const [search, setSearch] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('all');
  const [filterFrequency, setFilterFrequency] = useState('all');

  // Fetch schedules with firewall and client info
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['admin-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analysis_schedules')
        .select('id, firewall_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, firewalls(id, name, last_score, last_analysis_at, client_id, clients(id, name))')
        .order('next_run_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data as unknown as ScheduleRow[]) || [];
    },
  });

  // Fetch latest task per firewall
  const firewallIds = useMemo(() => schedules?.map(s => s.firewall_id) || [], [schedules]);

  const { data: latestTasks } = useQuery({
    queryKey: ['admin-schedule-tasks', firewallIds],
    enabled: firewallIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('target_id, status, completed_at')
        .in('target_id', firewallIds)
        .eq('target_type', 'firewall')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      // Keep only the latest task per firewall
      const map = new Map<string, TaskRow>();
      for (const task of (data || []) as TaskRow[]) {
        if (!map.has(task.target_id)) {
          map.set(task.target_id, task);
        }
      }
      return map;
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    if (!schedules) return { active: 0, next1h: 0, next6h: 0, next24h: 0, failed: 0 };
    const now = new Date();
    let active = 0, next1h = 0, next6h = 0, next24h = 0, failed = 0;

    for (const s of schedules) {
      if (s.is_active) active++;
      if (s.next_run_at) {
        const diff = differenceInHours(new Date(s.next_run_at), now);
        if (diff >= 0 && diff < 1) next1h++;
        if (diff >= 0 && diff < 6) next6h++;
        if (diff >= 0 && diff < 24) next24h++;
      }
      const task = latestTasks?.get(s.firewall_id);
      if (task && task.status === 'failed') failed++;
    }
    return { active, next1h, next6h, next24h, failed };
  }, [schedules, latestTasks]);

  // Filter and search
  const filtered = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter(s => {
      if (search && !s.firewalls?.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterWorkspace !== 'all' && s.firewalls?.clients?.id !== filterWorkspace) return false;
      if (filterFrequency !== 'all' && s.frequency !== filterFrequency) return false;
      return true;
    });
  }, [schedules, search, filterWorkspace, filterFrequency]);

  // Unique workspaces for filter
  const workspaces = useMemo(() => {
    if (!schedules) return [];
    const map = new Map<string, string>();
    for (const s of schedules) {
      if (s.firewalls?.clients) {
        map.set(s.firewalls.clients.id, s.firewalls.clients.name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [schedules]);

  const renderNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return <span className="text-muted-foreground">—</span>;
    const next = new Date(nextRunAt);
    const now = new Date();
    const diffMin = differenceInMinutes(next, now);

    if (diffMin < 0) {
      return <span className="text-muted-foreground">Atrasado</span>;
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
  };

  const renderTaskStatus = (firewallId: string) => {
    const task = latestTasks?.get(firewallId);
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

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Administração' },
            { label: 'Agendamentos' },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
          <p className="text-muted-foreground mt-1">Painel centralizado de agendamentos de análise</p>
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
              placeholder="Buscar firewall..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
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
                    <TableHead>Firewall</TableHead>
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
                      <TableCell className="font-medium text-foreground">
                        {schedule.firewalls?.name || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {schedule.firewalls?.clients?.name || '—'}
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
                        {renderNextRun(schedule.next_run_at)}
                      </TableCell>
                      <TableCell>
                        {schedule.firewalls?.last_score !== null && schedule.firewalls?.last_score !== undefined ? (
                          <Badge variant="outline" className={getScoreColor(schedule.firewalls.last_score)}>
                            {schedule.firewalls.last_score}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderTaskStatus(schedule.firewall_id)}
                      </TableCell>
                      <TableCell>
                        {schedule.is_active ? (
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
      </div>
    </AppLayout>
  );
}
