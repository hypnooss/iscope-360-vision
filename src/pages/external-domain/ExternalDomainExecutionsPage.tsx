import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Clock, CheckCircle2, XCircle, AlertTriangle, Timer, Loader2, RefreshCw, Eye, Ban, Search, Globe, Cloud, Terminal, Radar, Building2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateTimeFullBR } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface AnalysisHistory {
  id: string;
  domain_id: string;
  score: number | null;
  report_data: Json;
  analyzed_by: string | null;
  created_at: string;
  status: string;
  source: string;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
}

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  target_id: string;
  target_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  priority: number;
  payload?: Json;
  result?: Json;
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

interface AttackSurfaceSnapshotRow {
  id: string;
  client_id: string;
  status: string;
  score: number | null;
  summary: Json | null;
  created_at: string;
  completed_at: string | null;
}

interface UnifiedExecution {
  id: string;
  source: 'analysis' | 'agent_task' | 'attack_surface';
  domainId: string;
  agentId: string | null;
  type: 'api' | 'agent' | 'attack_surface';
  status: string;
  duration: string;
  createdAt: string;
  original: AnalysisHistory | AgentTask | AttackSurfaceSnapshotRow;
}

const statusConfig: Record<string, {label: string;color: string;icon: React.ReactNode;}> = {
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />
  },
  running: {
    label: 'Executando',
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />
  },
  completed: {
    label: 'Concluída',
    color: 'bg-green-500/20 text-green-500 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  failed: {
    label: 'Falhou',
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />
  },
  timeout: {
    label: 'Timeout',
    color: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    icon: <Timer className="w-3 h-3" />
  },
  cancelled: {
    label: 'Cancelada',
    color: 'bg-muted text-muted-foreground border-border',
    icon: <Ban className="w-3 h-3" />
  }
};

const typeConfig: Record<string, {label: string;color: string;}> = {
  api: {
    label: 'Domain Compliance',
    color: 'bg-teal-400/20 text-teal-400 border-teal-400/30',
  },
  agent: {
    label: 'Domain Compliance',
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  },
  attack_surface: {
    label: 'Surface Analyzer',
    color: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  }
};

export default function ExternalDomainExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisHistory | null>(null);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AttackSurfaceSnapshotRow | null>(null);
  const [snapshotDetailsOpen, setSnapshotDetailsOpen] = useState(false);
  const [selectedTaskSteps, setSelectedTaskSteps] = useState<TaskStepResultRow[]>([]);
  const [analysisDetailsOpen, setAnalysisDetailsOpen] = useState(false);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [taskToCancel, setTaskToCancel] = useState<AgentTask | null>(null);
  const [snapshotCancelOpen, setSnapshotCancelOpen] = useState(false);
  const [snapshotToCancel, setSnapshotToCancel] = useState<AttackSurfaceSnapshotRow | null>(null);
  const [analysisCancelOpen, setAnalysisCancelOpen] = useState(false);
  const [analysisToCancel, setAnalysisToCancel] = useState<AnalysisHistory | null>(null);
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
      case '1h':return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '12h':return new Date(now.getTime() - 12 * 60 * 60 * 1000);
      case '24h':return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  };

  const workspaceIds = isSuperRole && selectedWorkspaceId
    ? [selectedWorkspaceId]
    : isPreviewMode && previewTarget?.workspaces
      ? previewTarget.workspaces.map((w) => w.id)
      : null;

  // Lookup: domains
  const { data: domains = [] } = useQuery({
    queryKey: ['external-domains-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('external_domains').select('id, domain, name, client_id');
      if (error) throw error;
      return data || [];
    }
  });

  // Lookup: agents
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agents').select('id, name');
      if (error) throw error;
      return data || [];
    }
  });

  // Accessible domain IDs (for preview mode filtering)
  const accessibleDomainIds = useMemo(() => {
    if (!workspaceIds || workspaceIds.length === 0) return null;
    return domains.filter((d) => workspaceIds.includes(d.client_id)).map((d) => d.id);
  }, [domains, workspaceIds]);

  // Query: external_domain_analysis_history (API executions)
  const { data: analysisHistory = [], isLoading: isLoadingAnalysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ['external-domain-analysis-history', statusFilter, timeFilter, accessibleDomainIds],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      let query = supabase.
      from('external_domain_analysis_history').
      select('id, domain_id, score, report_data, analyzed_by, created_at, status, source, started_at, completed_at, execution_time_ms').
      eq('source', 'api').
      gte('created_at', startTime.toISOString()).
      order('created_at', { ascending: false }).
      limit(100);

      if (accessibleDomainIds && accessibleDomainIds.length > 0) {
        query = query.in('domain_id', accessibleDomainIds);
      } else if (accessibleDomainIds && accessibleDomainIds.length === 0) {
        return [] as AnalysisHistory[];
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AnalysisHistory[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as AnalysisHistory[] | undefined;
      const hasActive = data?.some((a) => a.status === 'pending' || a.status === 'running');
      return hasActive ? 10000 : false;
    },
    enabled: domains.length > 0 || !workspaceIds
  });

  // Query: agent_tasks (Agent executions)
  const { data: agentTasks = [], isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['external-domain-agent-tasks', statusFilter, timeFilter, accessibleDomainIds],
    queryFn: async () => {
      const startTime = getTimeFilterDate();

      if (accessibleDomainIds && accessibleDomainIds.length === 0) {
        return [] as AgentTask[];
      }

      let query = supabase.from('agent_tasks').select(`
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
        `).
      eq('target_type', 'external_domain').
      gte('created_at', startTime.toISOString()).
      order('created_at', { ascending: false }).
      limit(100);

      if (accessibleDomainIds && accessibleDomainIds.length > 0) {
        query = query.in('target_id', accessibleDomainIds);
      }

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
    enabled: domains.length > 0 || !workspaceIds
  });

  // Query: attack_surface_snapshots
  const { data: attackSurfaceSnapshots = [], isLoading: isLoadingSnapshots, refetch: refetchSnapshots } = useQuery({
    queryKey: ['attack-surface-executions', statusFilter, timeFilter, workspaceIds],
    queryFn: async () => {
      const startTime = getTimeFilterDate();

      let query = supabase.
      from('attack_surface_snapshots').
      select('id, client_id, status, score, summary, created_at, completed_at').
      gte('created_at', startTime.toISOString()).
      order('created_at', { ascending: false }).
      limit(100);

      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      } else if (workspaceIds && workspaceIds.length === 0) {
        return [] as AttackSurfaceSnapshotRow[];
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AttackSurfaceSnapshotRow[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as AttackSurfaceSnapshotRow[] | undefined;
      const hasActive = data?.some((s) => s.status === 'pending' || s.status === 'running' || s.status === 'processing');
      return hasActive ? 10000 : false;
    }
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getDuration = (item: {started_at?: string | null;completed_at?: string | null;execution_time_ms?: number | null;}) => {
    if (item.execution_time_ms) {
      return formatDuration(item.execution_time_ms);
    }
    if (!item.started_at) return '-';
    const end = item.completed_at ? new Date(item.completed_at) : new Date();
    const start = new Date(item.started_at);
    const ms = end.getTime() - start.getTime();
    return formatDuration(ms);
  };

  // Merge into unified list
  const unifiedExecutions = useMemo<UnifiedExecution[]>(() => {
    const apiItems: UnifiedExecution[] = analysisHistory.map((hist) => ({
      id: hist.id,
      source: 'analysis' as const,
      domainId: hist.domain_id,
      agentId: null,
      type: 'api' as const,
      status: hist.status || 'completed',
      duration: hist.execution_time_ms ? formatDuration(hist.execution_time_ms) : getDuration({
        started_at: hist.started_at,
        completed_at: hist.completed_at,
        execution_time_ms: hist.execution_time_ms
      }),
      createdAt: hist.created_at,
      original: hist
    }));

    const taskItems: UnifiedExecution[] = agentTasks.map((task) => ({
      id: task.id,
      source: 'agent_task' as const,
      domainId: task.target_id,
      agentId: task.agent_id,
      type: 'agent' as const,
      status: task.status,
      duration: getDuration(task),
      createdAt: task.created_at,
      original: task
    }));

    const snapshotItems: UnifiedExecution[] = attackSurfaceSnapshots.map((snap) => ({
      id: snap.id,
      source: 'attack_surface' as const,
      domainId: '',
      agentId: null,
      type: 'attack_surface' as const,
      status: snap.status === 'processing' ? 'running' : snap.status,
      duration: getDuration({ started_at: snap.created_at, completed_at: snap.completed_at, execution_time_ms: null }),
      createdAt: snap.created_at,
      original: snap
    }));

    return [...apiItems, ...taskItems, ...snapshotItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [analysisHistory, agentTasks, attackSurfaceSnapshots]);

  const hasActive = unifiedExecutions.some((e) => e.status === 'running' || e.status === 'pending');

  const stats = useMemo(() => ({
    total: unifiedExecutions.length,
    pending: unifiedExecutions.filter((e) => e.status === 'pending').length,
    running: unifiedExecutions.filter((e) => e.status === 'running').length,
    completed: unifiedExecutions.filter((e) => e.status === 'completed').length,
    failed: unifiedExecutions.filter((e) => ['failed', 'timeout', 'cancelled'].includes(e.status)).length
  }), [unifiedExecutions]);

  const getDomainLabel = (domainId: string) => {
    if (!domainId) return 'Attack Surface Scan';
    const d = domains.find((x) => x.id === domainId);
    if (!d) return domainId.slice(0, 8) + '...';
    const domain = (d.domain || '').trim();
    const name = (d.name || '').trim();
    if (!name) return domain;
    if (name.toLowerCase() === domain.toLowerCase()) return domain;
    return `${name} (${domain})`;
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || agentId.slice(0, 8) + '...';
  };

  const filteredExecutions = unifiedExecutions.filter((item) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const domain = domains.find((d) => d.id === item.domainId);
    const agent = item.agentId ? agents.find((a) => a.id === item.agentId) : null;
    return (
      domain?.name?.toLowerCase().includes(s) ||
      domain?.domain?.toLowerCase().includes(s) ||
      agent?.name?.toLowerCase().includes(s) ||
      item.type === 'api' && 'edge function'.includes(s) ||
      item.type === 'attack_surface' && 'attack surface'.includes(s));

  });

  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('agent_tasks').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Cancelada pelo usuário'
      }).eq('id', taskId).in('status', ['pending', 'running']);
      if (error) throw error;

      // Also cancel any associated analyzer snapshot
      await supabase
        .from('analyzer_snapshots' as any)
        .update({ status: 'cancelled' })
        .eq('agent_task_id', taskId)
        .in('status', ['pending', 'processing']);
    },
    onSuccess: async () => {
      toast.success('Tarefa cancelada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['external-domain-agent-tasks'] });
      setSelectedTask((prev) => {
        if (!prev || prev.id !== taskToCancel?.id) return prev;
        return {
          ...prev,
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: prev.error_message || 'Cancelada pelo usuário'
        };
      });
      setCancelOpen(false);
      setTaskToCancel(null);
    },
    onError: (e: any) => {
      console.error('Failed to cancel task:', e);
      toast.error('Erro ao cancelar tarefa', { description: e?.message });
    }
  });

  const requestCancel = (task: AgentTask) => {
    setTaskToCancel(task);
    setCancelOpen(true);
  };

  const cancelSnapshotMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('cancel-attack-surface-scan', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success('Scan de superfície cancelado com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['attack-surface-executions'] });
      setSnapshotCancelOpen(false);
      setSnapshotToCancel(null);
    },
    onError: (e: any) => {
      console.error('Failed to cancel snapshot:', e);
      toast.error('Erro ao cancelar scan', { description: e?.message });
    }
  });

  const requestSnapshotCancel = (snap: AttackSurfaceSnapshotRow) => {
    setSnapshotToCancel(snap);
    setSnapshotCancelOpen(true);
  };

  const cancelAnalysisMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      const { error } = await supabase
        .from('external_domain_analysis_history')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', analysisId)
        .in('status', ['pending', 'running']);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Análise cancelada com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['external-domain-analysis-history'] });
      setAnalysisCancelOpen(false);
      setAnalysisToCancel(null);
    },
    onError: (e: any) => {
      console.error('Failed to cancel analysis:', e);
      toast.error('Erro ao cancelar análise', { description: e?.message });
    },
  });

  const requestAnalysisCancel = (analysis: AnalysisHistory) => {
    setAnalysisToCancel(analysis);
    setAnalysisCancelOpen(true);
  };

  const openDetails = async (item: UnifiedExecution) => {
    if (item.source === 'analysis') {
      setSelectedAnalysis(item.original as AnalysisHistory);
      setAnalysisDetailsOpen(true);
    } else if (item.source === 'attack_surface') {
      setSelectedSnapshot(item.original as AttackSurfaceSnapshotRow);
      setSnapshotDetailsOpen(true);
    } else {
      const task = item.original as AgentTask;
      setSelectedTask(task);
      setSelectedTaskSteps([]);
      setTaskDetailsOpen(true);
      setLoadingDetails(true);
      try {
        const { data: taskDetails } = await supabase.
        from('agent_tasks').
        select('payload, result, error_message, execution_time_ms, started_at, completed_at').
        eq('id', task.id).
        maybeSingle();
        if (taskDetails) {
          setSelectedTask((prev) => prev ? { ...prev, ...taskDetails } : prev);
        }
        const { data: steps, error: stepsError } = await supabase.
        from('task_step_results').
        select('id, task_id, step_id, status, duration_ms, error_message, data, created_at').
        eq('task_id', task.id).
        order('created_at', { ascending: true });
        if (stepsError) throw stepsError;
        setSelectedTaskSteps((steps || []) as TaskStepResultRow[]);
      } catch (e: any) {
        console.error('Failed to load task details:', e);
        toast.error('Erro ao carregar detalhes', { description: e?.message });
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleRefresh = () => {
    refetchAnalysis();
    refetchTasks();
    refetchSnapshots();
  };

  const isLoading = isLoadingAnalysis || isLoadingTasks || isLoadingSnapshots;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
        { label: 'Domínio Externo' },
        { label: 'Execuções' }]
        } />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Execuções de Análises</h1>
            <p className="text-muted-foreground">Monitore as análises via API e via Agent</p>
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por domínio ou agente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10" />
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
              <SelectItem value="timeout">Timeout</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unified Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {isLoading ?
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div> :
            filteredExecutions.length === 0 ?
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mb-4 opacity-50" />
                <p>Nenhuma execução encontrada</p>
                <p className="text-sm mt-1">As execuções aparecerão aqui quando forem iniciadas</p>
              </div> :

            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecutions.map((item) => {
                  const sConfig = statusConfig[item.status] || statusConfig.pending;
                  const tConfig = typeConfig[item.type];
                  return (
                    <TableRow key={`${item.source}-${item.id}`}>
                        <TableCell className="font-medium">
                          {item.type === 'attack_surface' ? '-' : getDomainLabel(item.domainId)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.type === 'api' ? 'Edge Function' : item.agentId ? getAgentName(item.agentId) : '-'}
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
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.duration}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.source === 'analysis' && ['pending', 'running'].includes(item.status) &&
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestAnalysisCancel(item.original as AnalysisHistory)}
                            disabled={cancelAnalysisMutation.isPending}
                            title="Cancelar análise">
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                          }
                            {item.source === 'agent_task' && ['pending', 'running'].includes(item.status) &&
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestCancel(item.original as AgentTask)}
                            disabled={cancelMutation.isPending}
                            title="Cancelar tarefa">
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                          }
                            {item.source === 'attack_surface' && ['pending', 'running'].includes(item.status) &&
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestSnapshotCancel(item.original as AttackSurfaceSnapshotRow)}
                            disabled={cancelSnapshotMutation.isPending}
                            title="Cancelar scan">
                                <Ban className="w-4 h-4 text-destructive" />
                              </Button>
                          }
                            <Button variant="ghost" size="icon" onClick={() => openDetails(item)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>);

                })}
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>

        {/* API Analysis Details Dialog */}
        <Dialog open={analysisDetailsOpen} onOpenChange={setAnalysisDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-500" />
                Detalhes da Análise via API
              </DialogTitle>
            </DialogHeader>
            {selectedAnalysis &&
            <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Domínio</p>
                      <p className="font-medium">{getDomainLabel(selectedAnalysis.domain_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="text-2xl font-bold">{selectedAnalysis.score}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Origem</p>
                      <Badge variant="outline" className={cn('gap-1', typeConfig.api.color)}>
                        Edge Function
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Criado em</p>
                      <p className="font-medium">
                        {formatDateTimeFullBR(selectedAnalysis.created_at)}
                      </p>
                    </div>
                  </div>

                  {selectedAnalysis.report_data &&
                <div>
                      <p className="text-sm text-muted-foreground mb-2">Dados do Relatório (JSON)</p>
                      <div className="bg-muted/50 border rounded-lg p-3">
                        <ScrollArea className="h-[300px]">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedAnalysis.report_data, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                }
                </div>
              </ScrollArea>
            }
          </DialogContent>
        </Dialog>

        {/* Attack Surface Snapshot Details Dialog */}
        <Dialog open={snapshotDetailsOpen} onOpenChange={setSnapshotDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radar className="w-5 h-5 text-cyan-500" />
                Detalhes do Attack Surface Scan
              </DialogTitle>
            </DialogHeader>
            {selectedSnapshot &&
            <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <Badge variant="outline" className={cn('gap-1', typeConfig.attack_surface.color)}>
                        Attack Surface Scan
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="text-2xl font-bold">{selectedSnapshot.score != null ? `${selectedSnapshot.score}%` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={`${statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.color || statusConfig.pending.color} border`}>
                        {statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.icon}
                        <span className="ml-1">{statusConfig[selectedSnapshot.status === 'processing' ? 'running' : selectedSnapshot.status]?.label}</span>
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Criado em</p>
                      <p className="font-medium">
                        {formatDateTimeFullBR(selectedSnapshot.created_at)}
                      </p>
                    </div>
                    {selectedSnapshot.completed_at &&
                  <div>
                        <p className="text-sm text-muted-foreground">Concluído em</p>
                        <p className="font-medium">
                          {format(new Date(selectedSnapshot.completed_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                        </p>
                      </div>
                  }
                  </div>

                  {selectedSnapshot.summary &&
                <div>
                      <p className="text-sm text-muted-foreground mb-2">Resumo</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(() => {
                      const s = selectedSnapshot.summary as Record<string, unknown>;
                      return (
                        <>
                              <div className="bg-muted/50 border rounded-lg p-3 text-center">
                                <p className="text-xl font-bold">{s.total_ips as number ?? 0}</p>
                                <p className="text-xs text-muted-foreground">IPs</p>
                              </div>
                              <div className="bg-muted/50 border rounded-lg p-3 text-center">
                                <p className="text-xl font-bold">{s.open_ports as number ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Portas</p>
                              </div>
                              <div className="bg-muted/50 border rounded-lg p-3 text-center">
                                <p className="text-xl font-bold">{s.services as number ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Serviços</p>
                              </div>
                              <div className="bg-muted/50 border rounded-lg p-3 text-center">
                                <p className="text-xl font-bold">{s.cves as number ?? 0}</p>
                                <p className="text-xs text-muted-foreground">CVEs</p>
                              </div>
                            </>);

                    })()}
                      </div>
                    </div>
                }
                </div>
              </ScrollArea>
            }
          </DialogContent>
        </Dialog>

        {/* Agent Task Details Dialog */}
        <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-500" />
                Detalhes da Tarefa do Agent
              </DialogTitle>
            </DialogHeader>
            {selectedTask &&
            <div className="flex-1 overflow-y-auto space-y-6 pr-4">
                {loadingDetails &&
              <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
                  </div>
              }

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
                    <Badge variant="outline" className={cn('gap-1', typeConfig.agent.color)}>
                      Agent
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
                  {selectedTask.started_at &&
                <div>
                      <p className="text-sm text-muted-foreground">Iniciado em</p>
                      <p className="text-sm">{format(new Date(selectedTask.started_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                }
                  {selectedTask.completed_at &&
                <div>
                      <p className="text-sm text-muted-foreground">Concluído em</p>
                      <p className="text-sm">{format(new Date(selectedTask.completed_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</p>
                    </div>
                }
                </div>

                {selectedTask.error_message &&
              <div>
                    <p className="text-sm text-muted-foreground mb-2">Erro</p>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-sm text-destructive">{selectedTask.error_message}</p>
                    </div>
                  </div>
              }

                {selectedTask.payload &&
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
              }

                {selectedTaskSteps.length > 0 &&
              <div>
                    <p className="text-sm text-muted-foreground mb-2">Steps Executados</p>
                    <div className="space-y-2">
                      {selectedTaskSteps.map((step) => {
                    const ok = step.status === 'success';
                    const skipped = step.status === 'skipped';
                    const failed = !ok && !skipped;
                    return (
                      <div key={step.id} className={cn(
                        'rounded-lg border p-2',
                        ok && 'bg-green-500/10 border-green-500/30',
                        failed && 'bg-red-500/10 border-red-500/30',
                        skipped && 'bg-muted/50 border-border'
                      )}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {ok && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                {failed && <XCircle className="w-4 h-4 text-red-500" />}
                                {skipped && <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                                <span className="font-mono text-sm truncate">{step.step_id}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {step.duration_ms !== null &&
                            <span className="text-xs text-muted-foreground">{formatDuration(step.duration_ms)}</span>
                            }
                              </div>
                            </div>
                            {(step.error_message || step.data) &&
                        <div className="mt-2 space-y-2">
                                {step.error_message &&
                          <div className="text-xs text-destructive break-words">{step.error_message}</div>
                          }
                                {step.data &&
                          <div className="bg-muted/50 border rounded-md p-2">
                                    <ScrollArea className="h-[160px]">
                                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                        {JSON.stringify(step.data, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                          }
                              </div>
                        }
                          </div>);

                  })}
                    </div>
                  </div>
              }

                {selectedTask.result &&
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
              }
              </div>
            }
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
              <AlertDialogCancel onClick={() => setTaskToCancel(null)}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!taskToCancel) return;
                  cancelMutation.mutate(taskToCancel.id);
                }}
                disabled={!taskToCancel || cancelMutation.isPending}>

                {cancelMutation.isPending ? 'Encerrando...' : 'Encerrar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Surface Scan confirm */}
        <AlertDialog open={snapshotCancelOpen} onOpenChange={setSnapshotCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Surface Scan?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso cancelará o scan de superfície de ataque em andamento e todas as tarefas pendentes associadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSnapshotToCancel(null)}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!snapshotToCancel) return;
                  cancelSnapshotMutation.mutate(snapshotToCancel.client_id);
                }}
                disabled={!snapshotToCancel || cancelSnapshotMutation.isPending}>
                {cancelSnapshotMutation.isPending ? 'Cancelando...' : 'Cancelar Scan'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Analysis Confirmation */}
        <AlertDialog open={analysisCancelOpen} onOpenChange={setAnalysisCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar análise?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso marcará a análise API como <span className="font-medium">cancelada</span>.
                A execução será registrada como encerrada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAnalysisToCancel(null)}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!analysisToCancel) return;
                  cancelAnalysisMutation.mutate(analysisToCancel.id);
                }}
                disabled={!analysisToCancel || cancelAnalysisMutation.isPending}
              >
                {cancelAnalysisMutation.isPending ? 'Cancelando...' : 'Cancelar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>);

}