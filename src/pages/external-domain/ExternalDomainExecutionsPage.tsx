import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Loader2,
  RefreshCw,
  Eye,
  Ban,
  Search,
  Globe,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  target_id: string;
  target_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  priority: number;
  payload?: Json; // carregado sob demanda
  result?: Json; // carregado sob demanda
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  timeout_at: string | null;
}

interface TaskStepResultRow {
  id: string;
  task_id: string;
  step_id: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  data: Json | null;
  created_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  running: { label: 'Executando', color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: 'Concluída', color: 'bg-green-500/20 text-green-500 border-green-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: 'Falhou', color: 'bg-red-500/20 text-red-500 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
  timeout: { label: 'Timeout', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30', icon: <Timer className="w-3 h-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: <Ban className="w-3 h-3" /> },
};

export default function ExternalDomainExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('1h');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [selectedTaskSteps, setSelectedTaskSteps] = useState<TaskStepResultRow[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [taskToCancel, setTaskToCancel] = useState<AgentTask | null>(null);

  const queryClient = useQueryClient();

  const getTimeFilterDate = () => {
    const now = new Date();
    switch (timeFilter) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '12h':
        return new Date(now.getTime() - 12 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000);
    }
  };

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['external-domain-agent-tasks', statusFilter, timeFilter],
    queryFn: async () => {
      const startTime = getTimeFilterDate();

      let query = supabase
        .from('agent_tasks')
        .select(`
          id,
          agent_id,
          task_type,
          target_id,
          target_type,
          status,
          priority,
          error_message,
          execution_time_ms,
          created_at,
          started_at,
          completed_at,
          expires_at,
          timeout_at
        `)
        .eq('target_type', 'external_domain')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as AgentTask['status']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AgentTask[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as AgentTask[] | undefined;
      const hasActive = data?.some((t) => t.status === 'running' || t.status === 'pending');
      return hasActive ? 10000 : false;
    },
  });

  const hasActiveTasks = tasks.some((t) => t.status === 'running' || t.status === 'pending');

  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('agent_tasks')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Cancelada pelo usuário',
        })
        .eq('id', taskId)
        .in('status', ['pending', 'running']);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Tarefa cancelada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['external-domain-agent-tasks'] });

      // Atualiza detalhes abertos (se for a mesma task)
      setSelectedTask((prev) => {
        if (!prev || prev.id !== taskToCancel?.id) return prev;
        return {
          ...prev,
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: prev.error_message || 'Cancelada pelo usuário',
        };
      });

      setCancelOpen(false);
      setTaskToCancel(null);
    },
    onError: (e: any) => {
      console.error('Failed to cancel task:', e);
      toast.error('Erro ao cancelar tarefa', { description: e?.message });
    },
  });

  const requestCancel = (task: AgentTask) => {
    setTaskToCancel(task);
    setCancelOpen(true);
  };

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agents').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: domains = [] } = useQuery({
    queryKey: ['external-domains-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('external_domains').select('id, domain, name');
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      running: tasks.filter((t) => t.status === 'running').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      timeout: tasks.filter((t) => t.status === 'timeout').length,
    }),
    [tasks]
  );

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || 'Desconhecido';
  };

  const getDomainLabel = (domainId: string) => {
    const d = domains.find((x) => x.id === domainId);
    if (!d) return domainId;
    return d.name ? `${d.name} (${d.domain})` : d.domain;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const filteredTasks = tasks.filter((task) => {
    if (!searchTerm) return true;
    const domain = domains.find((d) => d.id === task.target_id);
    const agent = agents.find((a) => a.id === task.agent_id);
    const s = searchTerm.toLowerCase();
    return (
      domain?.name?.toLowerCase().includes(s) ||
      domain?.domain?.toLowerCase().includes(s) ||
      agent?.name?.toLowerCase().includes(s) ||
      task.task_type.toLowerCase().includes(s)
    );
  });

  const openDetails = async (task: AgentTask) => {
    setSelectedTask(task);
    setSelectedTaskSteps([]);
    setDetailsOpen(true);

    setLoadingDetails(true);
    try {
      // 1) Carregar campos "pesados" sob demanda
      const { data: taskDetails } = await supabase
        .from('agent_tasks')
        .select('payload, result, error_message, execution_time_ms, started_at, completed_at')
        .eq('id', task.id)
        .maybeSingle();

      if (taskDetails) {
        setSelectedTask((prev) => (prev ? { ...prev, ...taskDetails } : prev));
      }

      // 2) Carregar steps progressivos (fonte real no modo multi-step)
      const { data: steps, error: stepsError } = await supabase
        .from('task_step_results')
        .select('id, task_id, step_id, status, duration_ms, error_message, data, created_at')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (stepsError) throw stepsError;
      setSelectedTaskSteps((steps || []) as TaskStepResultRow[]);
    } catch (e: any) {
      console.error('Failed to load task details:', e);
      toast.error('Erro ao carregar detalhes da tarefa', { description: e?.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
            { label: 'Execuções' },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Execuções de Tarefas</h1>
            <p className="text-muted-foreground">
              Monitore e gerencie as verificações de domínios externos
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("w-4 h-4 mr-2", hasActiveTasks && "animate-spin")} />
            {hasActiveTasks ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.running}</p>
                  <p className="text-xs text-muted-foreground">Executando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Timer className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.timeout}</p>
                  <p className="text-xs text-muted-foreground">Timeout</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por domínio ou tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Última hora</SelectItem>
                  <SelectItem value="6h">Últimas 6 horas</SelectItem>
                  <SelectItem value="12h">Últimas 12 horas</SelectItem>
                  <SelectItem value="24h">Últimas 24 horas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mb-4 opacity-50" />
                <p>Nenhuma tarefa encontrada</p>
                <p className="text-sm mt-1">As execuções aparecerão aqui quando forem iniciadas</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const config = statusConfig[task.status] || statusConfig.pending;
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          {getDomainLabel(task.target_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getAgentName(task.agent_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {task.task_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${config.color} border`}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(task.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDuration(task.execution_time_ms)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(task.status === 'pending' || task.status === 'running') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => requestCancel(task)}
                              disabled={cancelMutation.isPending}
                              title="Encerrar execução"
                            >
                              <Ban className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails(task)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border">
            <DialogHeader>
              <DialogTitle>Detalhes da Tarefa</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="flex-1 overflow-y-auto space-y-6 pr-4">
                {loadingDetails && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Domínio</p>
                    <p className="font-medium">{getDomainLabel(selectedTask.target_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agent</p>
                    <p className="font-medium">{getAgentName(selectedTask.agent_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedTask.task_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={`${statusConfig[selectedTask.status]?.color} border`}>
                      {statusConfig[selectedTask.status]?.icon}
                      <span className="ml-1">{statusConfig[selectedTask.status]?.label}</span>
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prioridade</p>
                    <p className="font-medium">{selectedTask.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duração</p>
                    <p className="font-medium">{formatDuration(selectedTask.execution_time_ms)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="text-sm">{format(new Date(selectedTask.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                  </div>
                  {selectedTask.started_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Iniciado em</p>
                      <p className="text-sm">{format(new Date(selectedTask.started_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                  )}
                  {selectedTask.completed_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Concluído em</p>
                      <p className="text-sm">{format(new Date(selectedTask.completed_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                  )}
                </div>

                {selectedTask.error_message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Erro</p>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-sm text-destructive">{selectedTask.error_message}</p>
                    </div>
                  </div>
                )}

                {selectedTask.payload && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Payload (JSON)</p>
                    <div className="bg-muted/50 border rounded-lg p-3">
                      <ScrollArea className="h-[150px]">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(selectedTask.payload, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                )}

                {selectedTaskSteps.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Steps Executados</p>
                    <div className="space-y-2">
                      {selectedTaskSteps.map((step) => {
                        const ok = step.status === 'success';
                        const skipped = step.status === 'skipped';
                        const failed = !ok && !skipped;
                        return (
                          <div
                            key={step.id}
                            className={cn(
                              'rounded-lg border p-2',
                              ok && 'bg-green-500/10 border-green-500/30',
                              failed && 'bg-red-500/10 border-red-500/30',
                              skipped && 'bg-muted/50 border-border'
                            )}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {ok && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                {failed && <XCircle className="w-4 h-4 text-red-500" />}
                                {skipped && <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                                <span className="font-mono text-sm truncate">{step.step_id}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {step.duration_ms !== null && (
                                  <span className="text-xs text-muted-foreground">{formatDuration(step.duration_ms)}</span>
                                )}
                              </div>
                            </div>

                            {(step.error_message || step.data) && (
                              <div className="mt-2 space-y-2">
                                {step.error_message && (
                                  <div className="text-xs text-destructive break-words">{step.error_message}</div>
                                )}
                                {step.data && (
                                  <div className="bg-muted/50 border rounded-md p-2">
                                    <ScrollArea className="h-[160px]">
                                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                        {JSON.stringify(step.data, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedTask.result && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Resultado (JSON)</p>
                    <div className="bg-muted/50 border rounded-lg p-3">
                      <ScrollArea className="h-[200px]">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(selectedTask.result, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel confirm */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar execução?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso marcará a tarefa como <span className="font-medium">cancelada</span>. Se o agent já estiver executando, ele pode
                ainda terminar o step atual, mas a execução ficará registrada como encerrada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setTaskToCancel(null);
                }}
              >
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!taskToCancel) return;
                  cancelMutation.mutate(taskToCancel.id);
                }}
                disabled={!taskToCancel || cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Encerrando...' : 'Encerrar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
