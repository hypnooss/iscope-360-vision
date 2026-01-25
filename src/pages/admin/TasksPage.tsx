import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { TaskStatsCards } from "@/components/admin/TaskStatsCards";
import { TaskStatusChart } from "@/components/admin/TaskStatusChart";
import { TaskTimelineChart } from "@/components/admin/TaskTimelineChart";
import { TaskAgentPerformance } from "@/components/admin/TaskAgentPerformance";
import { TaskDetailDialog } from "@/components/admin/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Search, 
  Eye, 
  XCircle, 
  RefreshCw,
  CheckCircle2,
  Clock,
  PlayCircle,
  Timer,
  Ban,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Json } from "@/integrations/supabase/types";

type TaskStatus = "pending" | "running" | "completed" | "failed" | "timeout" | "cancelled";

interface Task {
  id: string;
  task_type: string;
  status: TaskStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  result: Json | null;
  step_results: Json | null;
  payload: Json;
  target_id: string;
  agent_id: string;
  firewall: { name: string } | null;
  agent: { name: string; client: { name: string } | null } | null;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; className: string }> = {
  pending: { icon: Clock, label: "Pendente", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
  running: { icon: PlayCircle, label: "Executando", className: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  completed: { icon: CheckCircle2, label: "Concluída", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  failed: { icon: XCircle, label: "Falhou", className: "bg-destructive/20 text-destructive border-destructive/30" },
  timeout: { icon: Timer, label: "Timeout", className: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
  cancelled: { icon: Ban, label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

export default function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("7d");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Calculate date range based on period filter
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case "24h": return subDays(now, 1);
      case "7d": return subDays(now, 7);
      case "30d": return subDays(now, 30);
      default: return subDays(now, 7);
    }
  }, [periodFilter]);

  // Fetch all tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["admin-tasks", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .select(`
          id,
          task_type,
          status,
          created_at,
          started_at,
          completed_at,
          execution_time_ms,
          error_message,
          result,
          step_results,
          payload,
          target_id,
          agent_id,
          firewall:firewalls(name),
          agent:agents(name, client:clients(name))
        `)
        .gte("created_at", dateRange.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
  });

  // Fetch agents for filter
  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    const result = {
      total: tasks.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
    };
    
    tasks.forEach(task => {
      if (task.status in result) {
        result[task.status as keyof typeof result]++;
      }
    });
    
    return result;
  }, [tasks]);

  // Calculate status chart data
  const statusChartData = useMemo(() => {
    return [
      { status: "pending", count: stats.pending, label: "Pendentes" },
      { status: "running", count: stats.running, label: "Executando" },
      { status: "completed", count: stats.completed, label: "Concluídas" },
      { status: "failed", count: stats.failed, label: "Falhas" },
      { status: "timeout", count: stats.timeout, label: "Timeout" },
    ];
  }, [stats]);

  // Calculate timeline data
  const timelineData = useMemo(() => {
    const days = periodFilter === "24h" ? 1 : periodFilter === "7d" ? 7 : 30;
    const dataMap: Record<string, { completed: number; failed: number; timeout: number }> = {};
    
    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      dataMap[date] = { completed: 0, failed: 0, timeout: 0 };
    }
    
    // Populate with task data
    tasks.forEach(task => {
      if (!task.completed_at) return;
      const date = format(new Date(task.completed_at), "yyyy-MM-dd");
      if (dataMap[date]) {
        if (task.status === "completed") dataMap[date].completed++;
        else if (task.status === "failed") dataMap[date].failed++;
        else if (task.status === "timeout") dataMap[date].timeout++;
      }
    });
    
    return Object.entries(dataMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, periodFilter]);

  // Calculate agent performance data
  const agentPerformanceData = useMemo(() => {
    const agentMap: Record<string, { name: string; total: number; completed: number; failed: number; totalTime: number }> = {};
    
    tasks.forEach(task => {
      const agentName = task.agent?.name || "Desconhecido";
      if (!agentMap[agentName]) {
        agentMap[agentName] = { name: agentName, total: 0, completed: 0, failed: 0, totalTime: 0 };
      }
      agentMap[agentName].total++;
      if (task.status === "completed") {
        agentMap[agentName].completed++;
        agentMap[agentName].totalTime += task.execution_time_ms || 0;
      }
      if (task.status === "failed" || task.status === "timeout") {
        agentMap[agentName].failed++;
      }
    });
    
    return Object.values(agentMap).map(agent => ({
      agent_name: agent.name,
      total_tasks: agent.total,
      avg_time_ms: agent.completed > 0 ? Math.round(agent.totalTime / agent.completed) : 0,
      completed: agent.completed,
      failed: agent.failed,
    }));
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = 
        !searchTerm ||
        task.firewall?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.agent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesAgent = agentFilter === "all" || task.agent_id === agentFilter;
      
      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [tasks, searchTerm, statusFilter, agentFilter]);

  // Cancel task mutation
  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("agent_tasks")
        .update({ status: "cancelled" })
        .eq("id", taskId)
        .eq("status", "pending");
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa cancelada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao cancelar tarefa");
    },
  });

  // Retry task mutation
  const retryMutation = useMutation({
    mutationFn: async (task: Task) => {
      const insertData = {
        agent_id: task.agent_id,
        target_id: task.target_id,
        task_type: task.task_type as "fortigate_compliance" | "fortigate_cve" | "ssh_command" | "snmp_query" | "ping_check",
        payload: task.payload,
        status: "pending" as const,
      };
      
      const { error } = await supabase
        .from("agent_tasks")
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa reenviada para execução");
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao reenviar tarefa");
    },
  });

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  const handleViewAnalysis = (task: Task) => {
    navigate(`/scope-firewall/firewalls/${task.target_id}/analysis`);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatRelativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `há ${days}d`;
    if (hours > 0) return `há ${hours}h`;
    if (minutes > 0) return `há ${minutes}min`;
    return "agora";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb
          items={[
            { label: "Administração", href: "/settings" },
            { label: "Tarefas" },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-muted-foreground">
            Monitore e gerencie as execuções dos agents
          </p>
        </div>

        {/* Stats Cards */}
        <TaskStatsCards stats={stats} isLoading={tasksLoading} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TaskStatusChart data={statusChartData} isLoading={tasksLoading} />
          <div className="lg:col-span-2">
            <TaskTimelineChart data={timelineData} isLoading={tasksLoading} />
          </div>
        </div>

        {/* Agent Performance */}
        <TaskAgentPerformance data={agentPerformanceData} isLoading={tasksLoading} />

        {/* Filters */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por firewall, agent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Agents</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Últimas 24h</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firewall</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma tarefa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.slice(0, 50).map(task => {
                    const status = statusConfig[task.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          {task.firewall?.name || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{task.agent?.name || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.agent?.client?.name || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn("flex items-center gap-1 w-fit", status.className)}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(task.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatDuration(task.execution_time_ms)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetails(task)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {task.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewAnalysis(task)}
                                title="Ver análise"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {task.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelMutation.mutate(task.id)}
                                title="Cancelar"
                                disabled={cancelMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            
                            {(task.status === "failed" || task.status === "timeout") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => retryMutation.mutate(task)}
                                title="Reenviar"
                                disabled={retryMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <TaskDetailDialog
          task={selectedTask}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
        />
      </div>
    </AppLayout>
  );
}
