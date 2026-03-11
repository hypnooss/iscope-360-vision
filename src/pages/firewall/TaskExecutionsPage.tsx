import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Play,
  Search,
  Shield,
  Gauge,
  Building2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateTimeFullBR } from '@/lib/dateUtils';
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
  payload?: Json;       // Carregado sob demanda
  result?: Json;        // Carregado sob demanda
  error_message: string | null;
  execution_time_ms: number | null;
  step_results?: Json;  // Carregado sob demanda
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  timeout_at: string | null;
}

interface StepResult {
  step_id: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  duration_ms: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
  running: { label: 'Executando', color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: 'Concluída', color: 'bg-green-500/20 text-green-500 border-green-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: 'Falhou', color: 'bg-red-500/20 text-red-500 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
  timeout: { label: 'Timeout', color: 'bg-orange-500/20 text-orange-500 border-orange-500/30', icon: <Timer className="w-3 h-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: <Ban className="w-3 h-3" /> },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  fortigate_compliance: {
    label: 'Firewall Compliance',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  },
  fortigate_analysis: {
    label: 'Firewall Compliance',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  },
  fortigate_analyzer: {
    label: 'Firewall Analyzer',
    color: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
  },
};

export default function TaskExecutionsPage() {
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const queryClient = useQueryClient();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('1h');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [taskToCancel, setTaskToCancel] = useState<AgentTask | null>(null);

  // Calculate time filter
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

  // Fetch tasks
  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-tasks', statusFilter, timeFilter, isPreviewMode, previewTarget?.workspaces, isSuperRole, selectedWorkspaceId],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      
      // Get workspace IDs to filter by (for preview mode)
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      // Get all firewalls the user can access
      let firewallsQuery = supabase
        .from('firewalls')
        .select('id')
        .limit(1000);
      
      if (isSuperRole && selectedWorkspaceId) {
        firewallsQuery = firewallsQuery.eq('client_id', selectedWorkspaceId);
      } else if (workspaceIds && workspaceIds.length > 0) {
        firewallsQuery = firewallsQuery.in('client_id', workspaceIds);
      }

      const { data: firewallRows, error: firewallsError } = await firewallsQuery;
      if (firewallsError) throw firewallsError;
      
      const firewallIds = (firewallRows ?? []).map((f) => f.id);
      if (firewallIds.length === 0) return [] as AgentTask[];
      
      let query = supabase
        .from('agent_tasks')
        .select(`
          id, agent_id, task_type, target_id, target_type, status, priority,
          error_message, execution_time_ms, created_at, started_at, completed_at, expires_at, timeout_at
        `)
        .eq('target_type', 'firewall')
        .in('target_id', firewallIds)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as AgentTask['status']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AgentTask[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as AgentTask[] | undefined;
      const hasActiveTasks = data?.some(
        t => t.status === 'running' || t.status === 'pending'
      );
      return hasActiveTasks ? 10000 : false;
    },
  });

  // Detectar se há tarefas ativas para indicador visual
  const hasActiveTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');

  // Fetch agents for name lookup
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch firewalls for name lookup
  const { data: firewalls = [] } = useQuery({
    queryKey: ['firewalls-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firewalls')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Cancel task mutation
  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('agent_tasks')
        .update({ 
          status: 'cancelled', 
          completed_at: new Date().toISOString(),
          error_message: 'Cancelada pelo usuário'
        })
        .eq('id', taskId)
        .in('status', ['pending', 'running']);
      
      if (error) throw error;

      // Also cancel any associated analyzer snapshot
      await supabase
        .from('analyzer_snapshots' as any)
        .update({ status: 'cancelled' })
        .eq('agent_task_id', taskId)
        .in('status', ['pending', 'processing']);
    },
    onSuccess: () => {
      toast.success('Tarefa cancelada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analyzer-progress'] });
      queryClient.invalidateQueries({ queryKey: ['analyzer-latest'] });
      setCancelOpen(false);
      setTaskToCancel(null);
    },
    onError: () => {
      toast.error('Erro ao cancelar tarefa');
    },
  });

  const requestCancel = (task: AgentTask) => {
    setTaskToCancel(task);
    setCancelOpen(true);
  };

  // Calculate stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    timeout: tasks.filter(t => t.status === 'timeout').length,
  };

  // Filter tasks by search
  const filteredTasks = tasks.filter(task => {
    if (!searchTerm) return true;
    const firewall = firewalls.find(f => f.id === task.target_id);
    const agent = agents.find(a => a.id === task.agent_id);
    const searchLower = searchTerm.toLowerCase();
    return (
      firewall?.name?.toLowerCase().includes(searchLower) ||
      agent?.name?.toLowerCase().includes(searchLower) ||
      task.task_type.toLowerCase().includes(searchLower)
    );
  });

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || 'Desconhecido';
  };

  const getFirewallName = (targetId: string) => {
    const firewall = firewalls.find(f => f.id === targetId);
    return firewall?.name || 'Desconhecido';
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const openDetails = async (task: AgentTask) => {
    setSelectedTask(task);
    setDetailsOpen(true);
    
    // Carregar dados pesados sob demanda se ainda não carregados
    if (!task.result && !task.payload) {
      setLoadingDetails(true);
      try {
        const { data, error } = await supabase
          .from('agent_tasks')
          .select('result, step_results, payload')
          .eq('id', task.id)
          .maybeSingle();
        
        if (data && !error) {
          setSelectedTask({ ...task, ...data });
        }
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Compliance', href: '/scope-firewall/reports' },
            { label: 'Execuções' },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Execuções de Tarefas</h1>
            <p className="text-muted-foreground">
              Monitore e gerencie as tarefas enviadas aos agents
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isSuperRole && !isPreviewMode && allWorkspaces && allWorkspaces.length > 0 && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className={cn("w-4 h-4 mr-2", hasActiveTasks && "animate-spin")} />
              {hasActiveTasks ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
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
                    placeholder="Buscar por firewall, agent ou tipo..."
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
                <Activity className="w-12 h-12 mb-4 opacity-50" />
                <p>Nenhuma tarefa encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firewall</TableHead>
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
                          {getFirewallName(task.target_id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getAgentName(task.agent_id)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const tConfig = typeConfig[task.task_type];
                            if (tConfig) {
                              return (
                                <Badge variant="outline" className={cn('gap-1', tConfig.color)}>
                                  {tConfig.label}
                                </Badge>
                              );
                            }
                            return (
                              <Badge variant="outline" className="font-mono text-xs">
                                {task.task_type}
                              </Badge>
                            );
                          })()}
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetails(task)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(task.status === 'pending' || task.status === 'running') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => requestCancel(task)}
                                disabled={cancelMutation.isPending}
                                title="Cancelar tarefa"
                              >
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Task Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border">
            <DialogHeader className="flex-shrink-0">
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
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Firewall</p>
                    <p className="font-medium">{getFirewallName(selectedTask.target_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agent</p>
                    <p className="font-medium">{getAgentName(selectedTask.agent_id)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <Badge variant="outline" className={`font-mono text-xs ${typeConfig[selectedTask.task_type]?.color ?? ''}`}>
                      {typeConfig[selectedTask.task_type]?.label ?? selectedTask.task_type}
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

                {/* Timestamps */}
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

                {/* Error Message */}
                {selectedTask.error_message && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Erro</p>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-sm text-destructive">{selectedTask.error_message}</p>
                    </div>
                  </div>
                )}

                {/* Step Results */}
                {selectedTask.step_results && Array.isArray(selectedTask.step_results) && (selectedTask.step_results as unknown as StepResult[]).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Steps Executados</p>
                    <div className="space-y-2">
                      {(selectedTask.step_results as unknown as StepResult[]).map((step, index) => (
                        <div 
                          key={index} 
                          className={`flex items-center justify-between p-2 rounded-lg border ${
                            step.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                            step.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                            'bg-muted/50 border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {step.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                            {step.status === 'skipped' && <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                            <span className="font-mono text-sm">{step.step_id}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            {step.error && (
                              <span className="text-xs text-red-400 max-w-[200px] truncate" title={step.error}>
                                {step.error}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(step.duration_ms)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Result */}
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

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar execução?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso marcará a tarefa como <span className="font-medium">cancelada</span>.
                Se o agent já estiver executando, ele pode ainda terminar o step atual,
                mas a execução ficará registrada como encerrada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTaskToCancel(null)}>
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
