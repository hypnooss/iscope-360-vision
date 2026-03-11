import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';

import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Clock, CheckCircle2, XCircle, Loader2, RefreshCw, Eye, Search, Cloud, Terminal, Timer, Ban, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PostureHistory {
  id: string;
  tenant_record_id: string;
  client_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled';
  score: number | null;
  classification: string | null;
  summary: any;
  category_breakdown: any;
  errors: any;
  analyzed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  target_id: string;
  target_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  payload: any;
  result: any;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface AnalyzerSnapshot {
  id: string;
  tenant_record_id: string;
  client_id: string;
  status: string;
  score: number | null;
  summary: any;
  insights: any;
  period_start: string | null;
  period_end: string | null;
  agent_task_id: string | null;
  created_at: string;
}

interface UnifiedExecution {
  id: string;
  source: 'posture' | 'agent_task' | 'analyzer_snapshot';
  tenantId: string;
  agentId: string | null;
  type: 'posture_analysis' | 'm365_powershell' | 'm365_graph_api' | 'm365_analyzer';
  status: string;
  duration: string;
  createdAt: string;
  original: PostureHistory | AgentTask | AnalyzerSnapshot;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  running: {
    label: 'Executando',
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: 'Concluída',
    color: 'bg-green-500/20 text-green-500 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: 'Falhou',
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
  timeout: {
    label: 'Timeout',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    icon: <Timer className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelada',
    color: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
  partial: {
    label: 'Parcial',
    color: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  posture_analysis: {
    label: 'M365 Compliance',
    color: 'bg-teal-400/20 text-teal-400 border-teal-400/30',
  },
  m365_powershell: {
    label: 'M365 Compliance',
    color: 'bg-teal-400/20 text-teal-400 border-teal-400/30',
  },
  m365_analyzer: {
    label: 'M365 Analyzer',
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  },
  m365_graph_api: {
    label: 'M365 Analyzer',
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  },
};

export default function M365ExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<PostureHistory | null>(null);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AnalyzerSnapshot | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [snapshotDetailsOpen, setSnapshotDetailsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [taskToCancel, setTaskToCancel] = useState<AgentTask | null>(null);
  const [postureCancelOpen, setPostureCancelOpen] = useState(false);
  const [postureToCancel, setPostureToCancel] = useState<PostureHistory | null>(null);

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

  const getTimeFilterDate = () => {
    const now = new Date();
    switch (timeFilter) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h': return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '12h': return new Date(now.getTime() - 12 * 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  };

  const workspaceIds = isSuperRole && selectedWorkspaceId
    ? [selectedWorkspaceId]
    : isPreviewMode && previewTarget?.workspaces
      ? previewTarget.workspaces.map(w => w.id)
      : null;

  const { data: tenants = [] } = useQuery({
    queryKey: ['m365-tenants-lookup', workspaceIds],
    queryFn: async () => {
      let query = supabase
        .from('m365_tenants')
        .select('id, tenant_domain, display_name, client_id');
      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agents').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: executions = [], isLoading: isLoadingPosture, refetch: refetchPosture } = useQuery({
    queryKey: ['m365-posture-history', statusFilter, timeFilter, workspaceIds],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      let query = supabase
        .from('m365_posture_history')
        .select('id, tenant_record_id, client_id, status, score, classification, summary, category_breakdown, errors, analyzed_by, started_at, completed_at, created_at')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PostureHistory[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as PostureHistory[] | undefined;
      const hasActive = data?.some(e => e.status === 'running' || e.status === 'pending' || e.status === 'partial');
      return hasActive ? 10000 : false;
    },
  });

  const { data: agentTasks = [], isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['m365-agent-tasks', statusFilter, timeFilter, tenants],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      const tenantIds = tenants.map(t => t.id);
      if (tenantIds.length === 0) return [];
      let query = supabase
        .from('agent_tasks')
        .select('id, agent_id, task_type, target_id, target_type, status, payload, result, error_message, execution_time_ms, created_at, started_at, completed_at')
        .eq('target_type', 'm365_tenant')
        .in('target_id', tenantIds)
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as AgentTask['status']);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AgentTask[];
    },
    enabled: tenants.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data as AgentTask[] | undefined;
      const hasActive = data?.some(t => t.status === 'running' || t.status === 'pending');
      return hasActive ? 5000 : false;
    },
  });

  // Analyzer Snapshots (Edge Function side of M365 Analyzer)
  const { data: analyzerSnapshots = [], isLoading: isLoadingSnapshots, refetch: refetchSnapshots } = useQuery({
    queryKey: ['m365-analyzer-snapshots', statusFilter, timeFilter, workspaceIds],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      let query = supabase
        .from('m365_analyzer_snapshots')
        .select('id, tenant_record_id, client_id, status, score, summary, insights, period_start, period_end, agent_task_id, created_at')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AnalyzerSnapshot[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as AnalyzerSnapshot[] | undefined;
      const hasActive = data?.some(s => s.status === 'pending' || s.status === 'processing');
      return hasActive ? 10000 : false;
    },
  });

  const getDuration = (item: { started_at: string | null; completed_at: string | null; execution_time_ms?: number | null }) => {
    if ('execution_time_ms' in item && item.execution_time_ms) {
      const ms = item.execution_time_ms;
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60000).toFixed(1)}m`;
    }
    if (!item.started_at) return '-';
    const end = item.completed_at ? new Date(item.completed_at) : new Date();
    const start = new Date(item.started_at);
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Merge into unified list
  const unifiedExecutions = useMemo<UnifiedExecution[]>(() => {
    const postureItems: UnifiedExecution[] = executions.map(exec => ({
      id: exec.id,
      source: 'posture' as const,
      tenantId: exec.tenant_record_id,
      agentId: null,
      type: 'posture_analysis' as const,
      status: exec.status,
      duration: getDuration(exec),
      createdAt: exec.created_at,
      original: exec,
    }));

    const taskItems: UnifiedExecution[] = agentTasks.map(task => ({
      id: task.id,
      source: 'agent_task' as const,
      tenantId: task.target_id,
      agentId: task.agent_id,
      type: (['m365_graph_api', 'm365_powershell', 'm365_analyzer'].includes(task.task_type) ? task.task_type : 'm365_powershell') as UnifiedExecution['type'],
      status: task.status,
      duration: getDuration(task),
      createdAt: task.created_at,
      original: task,
    }));

    const snapshotItems: UnifiedExecution[] = analyzerSnapshots.map(snap => ({
      id: snap.id,
      source: 'analyzer_snapshot' as const,
      tenantId: snap.tenant_record_id,
      agentId: null,
      type: 'm365_graph_api' as const,
      status: snap.status === 'processing' ? 'running' : snap.status,
      duration: '-',
      createdAt: snap.created_at,
      original: snap,
    }));

    return [...postureItems, ...taskItems, ...snapshotItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [executions, agentTasks, analyzerSnapshots]);

  const hasActive = unifiedExecutions.some(e => e.status === 'running' || e.status === 'pending' || e.status === 'partial');

  const stats = useMemo(() => ({
    total: unifiedExecutions.length,
    pending: unifiedExecutions.filter(e => e.status === 'pending').length,
    running: unifiedExecutions.filter(e => e.status === 'running').length,
    completed: unifiedExecutions.filter(e => e.status === 'completed').length,
    failed: unifiedExecutions.filter(e => ['failed', 'timeout', 'cancelled'].includes(e.status)).length,
  }), [unifiedExecutions]);

  const getTenantLabel = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.display_name || tenant?.tenant_domain || tenantId.slice(0, 8) + '...';
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'N/A';
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || agentId.slice(0, 8) + '...';
  };

  const getClientFromTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return 'N/A';
    return getClientName(tenant.client_id);
  };

  const filteredExecutions = unifiedExecutions.filter(item => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const tenant = tenants.find(t => t.id === item.tenantId);
    const agent = item.agentId ? agents.find(a => a.id === item.agentId) : null;
    const client = tenant ? clients.find(c => c.id === tenant.client_id) : null;
    return (
      tenant?.display_name?.toLowerCase().includes(s) ||
      tenant?.tenant_domain?.toLowerCase().includes(s) ||
      agent?.name?.toLowerCase().includes(s) ||
      client?.name?.toLowerCase().includes(s)
    );
  });

  const openDetails = (item: UnifiedExecution) => {
    if (item.source === 'posture') {
      setSelectedExecution(item.original as PostureHistory);
      setDetailsOpen(true);
    } else if (item.source === 'analyzer_snapshot') {
      setSelectedSnapshot(item.original as AnalyzerSnapshot);
      setSnapshotDetailsOpen(true);
    } else {
      setSelectedTask(item.original as AgentTask);
      setTaskDetailsOpen(true);
    }
  };

  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('agent_tasks')
        .update({
          status: 'cancelled' as const,
          completed_at: new Date().toISOString(),
          error_message: 'Cancelada pelo usuário'
        })
        .eq('id', taskId)
        .in('status', ['pending', 'running']);
      if (error) throw error;

      // Also cancel any associated snapshots (m365_posture_history)
      await supabase
        .from('m365_posture_history')
        .update({ status: 'cancelled' })
        .eq('agent_task_id', taskId)
        .in('status', ['pending', 'running']);
    },
    onSuccess: async () => {
      toast.success('Tarefa cancelada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['m365-agent-tasks'] });
      setSelectedTask(prev => {
        if (!prev || prev.id !== taskToCancel?.id) return prev;
        return {
          ...prev,
          status: 'cancelled' as const,
          completed_at: new Date().toISOString(),
          error_message: prev.error_message || 'Cancelada pelo usuário'
        };
      });
      setCancelOpen(false);
      setTaskToCancel(null);
    },
    onError: (e: any) => {
      toast.error('Erro ao cancelar tarefa', { description: e?.message });
    }
  });

  const requestCancel = (task: AgentTask) => {
    setTaskToCancel(task);
    setCancelOpen(true);
  };

  const cancelPostureMutation = useMutation({
    mutationFn: async (postureId: string) => {
      const { error } = await supabase
        .from('m365_posture_history')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', postureId)
        .in('status', ['pending', 'running', 'partial']);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Análise cancelada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['m365-posture-history'] });
      setPostureCancelOpen(false);
      setPostureToCancel(null);
    },
    onError: (e: any) => {
      toast.error('Erro ao cancelar análise', { description: e?.message });
    },
  });

  const requestPostureCancel = (posture: PostureHistory) => {
    setPostureToCancel(posture);
    setPostureCancelOpen(true);
  };

  const handleRefresh = () => {
    refetchPosture();
    refetchTasks();
    refetchSnapshots();
  };

  const isLoading = isLoadingPosture || isLoadingTasks || isLoadingSnapshots;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Execuções' },
        ]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Execuções de Análise</h1>
            <p className="text-muted-foreground">Monitore as análises de postura e tarefas do agente M365</p>
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
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className={cn("w-4 h-4 mr-2", hasActive && "animate-spin")} />
              {hasActive ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por tenant, agente ou workspace..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
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
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
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
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Unified Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma execução encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecutions.map(item => {
                    const sConfig = statusConfig[item.status] || statusConfig.pending;
                    const tConfig = typeConfig[item.type] || typeConfig.posture_analysis;
                    return (
                      <TableRow key={`${item.source}-${item.id}`}>
                        <TableCell className="font-medium">
                          {getTenantLabel(item.tenantId)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.source === 'posture' || item.source === 'analyzer_snapshot'
                            ? 'Edge Function'
                            : item.agentId ? getAgentName(item.agentId) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1', tConfig.color)}>
                            {tConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1', sConfig.color)}>
                            {sConfig.icon}
                            {sConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.duration}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { locale: ptBR, addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.source === 'posture' && ['pending', 'running', 'partial'].includes(item.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => requestPostureCancel(item.original as PostureHistory)}
                                disabled={cancelPostureMutation.isPending}
                                title="Cancelar análise"
                              >
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                            {item.source === 'agent_task' && ['pending', 'running'].includes(item.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => requestCancel(item.original as AgentTask)}
                                disabled={cancelMutation.isPending}
                                title="Cancelar tarefa"
                              >
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openDetails(item)}>
                              <Eye className="w-4 h-4" />
                            </Button>
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

        {/* Posture Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Análise de Postura</DialogTitle>
            </DialogHeader>
            {selectedExecution && (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tenant</p>
                      <p className="font-medium">{getTenantLabel(selectedExecution.tenant_record_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Workspace</p>
                      <p className="font-medium">{getClientName(selectedExecution.client_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="outline" className={cn('gap-1', statusConfig[selectedExecution.status]?.color)}>
                        {statusConfig[selectedExecution.status]?.icon}
                        {statusConfig[selectedExecution.status]?.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="font-medium">
                        {selectedExecution.score !== null ? `${selectedExecution.score}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Iniciado em</p>
                      <p className="font-medium">
                        {selectedExecution.started_at
                          ? format(new Date(selectedExecution.started_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Concluído em</p>
                      <p className="font-medium">
                        {selectedExecution.completed_at
                          ? format(new Date(selectedExecution.completed_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {selectedExecution.summary && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Resumo</p>
                      <div className="grid grid-cols-5 gap-2">
                        <div className="p-2 bg-red-500/10 rounded text-center">
                          <p className="text-lg font-bold text-red-500">{selectedExecution.summary.critical || 0}</p>
                          <p className="text-xs text-muted-foreground">Crítico</p>
                        </div>
                        <div className="p-2 bg-orange-500/10 rounded text-center">
                          <p className="text-lg font-bold text-orange-500">{selectedExecution.summary.high || 0}</p>
                          <p className="text-xs text-muted-foreground">Alto</p>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded text-center">
                          <p className="text-lg font-bold text-yellow-500">{selectedExecution.summary.medium || 0}</p>
                          <p className="text-xs text-muted-foreground">Médio</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded text-center">
                          <p className="text-lg font-bold text-blue-500">{selectedExecution.summary.low || 0}</p>
                          <p className="text-xs text-muted-foreground">Baixo</p>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-lg font-bold">{selectedExecution.summary.total || 0}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedExecution.errors && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Erros</p>
                      <pre className="p-3 bg-destructive/10 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(selectedExecution.errors, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Task Details Dialog */}
        <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Detalhes da Task PowerShell
              </DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tenant</p>
                      <p className="font-medium">{getTenantLabel(selectedTask.target_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Workspace</p>
                      <p className="font-medium">{getClientFromTenant(selectedTask.target_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Agente</p>
                      <p className="font-medium">{getAgentName(selectedTask.agent_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <Badge variant="outline" className={cn('gap-1', typeConfig[selectedTask.task_type]?.color)}>
                        {typeConfig[selectedTask.task_type]?.label || selectedTask.task_type}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="outline" className={cn('gap-1', statusConfig[selectedTask.status]?.color)}>
                        {statusConfig[selectedTask.status]?.icon}
                        {statusConfig[selectedTask.status]?.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duração</p>
                      <p className="font-medium">
                        {selectedTask.execution_time_ms
                          ? `${(selectedTask.execution_time_ms / 1000).toFixed(2)}s`
                          : getDuration(selectedTask)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Iniciado em</p>
                      <p className="font-medium">
                        {selectedTask.started_at
                          ? format(new Date(selectedTask.started_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Concluído em</p>
                      <p className="font-medium">
                        {selectedTask.completed_at
                          ? format(new Date(selectedTask.completed_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  {selectedTask.payload && Object.keys(selectedTask.payload).length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Payload (Comandos)</p>
                      <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-40 font-mono">
                        {JSON.stringify(selectedTask.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedTask.result && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Resultado</p>
                      <pre className="p-3 bg-green-500/10 rounded text-xs overflow-auto max-h-60 font-mono">
                        {JSON.stringify(selectedTask.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedTask.error_message && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Erro</p>
                      <pre className="p-3 bg-destructive/10 rounded text-xs overflow-auto max-h-40 text-destructive">
                        {selectedTask.error_message}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Analyzer Snapshot Details Dialog */}
        <Dialog open={snapshotDetailsOpen} onOpenChange={setSnapshotDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Detalhes do Snapshot — M365 Analyzer
              </DialogTitle>
            </DialogHeader>
            {selectedSnapshot && (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tenant</p>
                      <p className="font-medium">{getTenantLabel(selectedSnapshot.tenant_record_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Workspace</p>
                      <p className="font-medium">{getClientName(selectedSnapshot.client_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant="outline" className={cn('gap-1', statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.color)}>
                        {statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.icon}
                        {statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="font-medium">
                        {selectedSnapshot.score !== null ? `${selectedSnapshot.score}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Período Início</p>
                      <p className="font-medium">
                        {selectedSnapshot.period_start
                          ? format(new Date(selectedSnapshot.period_start), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Período Fim</p>
                      <p className="font-medium">
                        {selectedSnapshot.period_end
                          ? format(new Date(selectedSnapshot.period_end), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Criado em</p>
                      <p className="font-medium">
                        {format(new Date(selectedSnapshot.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {selectedSnapshot.summary && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Resumo de Severidade</p>
                      <div className="grid grid-cols-5 gap-2">
                        <div className="p-2 bg-red-500/10 rounded text-center">
                          <p className="text-lg font-bold text-red-500">{selectedSnapshot.summary.critical || 0}</p>
                          <p className="text-xs text-muted-foreground">Crítico</p>
                        </div>
                        <div className="p-2 bg-orange-500/10 rounded text-center">
                          <p className="text-lg font-bold text-orange-500">{selectedSnapshot.summary.high || 0}</p>
                          <p className="text-xs text-muted-foreground">Alto</p>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded text-center">
                          <p className="text-lg font-bold text-yellow-500">{selectedSnapshot.summary.medium || 0}</p>
                          <p className="text-xs text-muted-foreground">Médio</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded text-center">
                          <p className="text-lg font-bold text-blue-500">{selectedSnapshot.summary.low || 0}</p>
                          <p className="text-xs text-muted-foreground">Baixo</p>
                        </div>
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-lg font-bold">{selectedSnapshot.summary.info || 0}</p>
                          <p className="text-xs text-muted-foreground">Info</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSnapshot.insights && Array.isArray(selectedSnapshot.insights) && selectedSnapshot.insights.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Insights ({selectedSnapshot.insights.length})</p>
                      <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-60 font-mono">
                        {JSON.stringify(selectedSnapshot.insights.slice(0, 10), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
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

        {/* Cancel Posture Analysis Confirmation */}
        <AlertDialog open={postureCancelOpen} onOpenChange={setPostureCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar análise de postura?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso marcará a análise de postura como <span className="font-medium">cancelada</span>.
                Se houver tarefas do agent associadas, elas não serão afetadas por esta ação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPostureToCancel(null)}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!postureToCancel) return;
                  cancelPostureMutation.mutate(postureToCancel.id);
                }}
                disabled={!postureToCancel || cancelPostureMutation.isPending}
              >
                {cancelPostureMutation.isPending ? 'Cancelando...' : 'Cancelar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
