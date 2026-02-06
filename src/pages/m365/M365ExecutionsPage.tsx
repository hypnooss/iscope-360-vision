import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePreview } from '@/contexts/PreviewContext';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Eye, Search, Cloud } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PostureHistory {
  id: string;
  tenant_record_id: string;
  client_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
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
};

export default function M365ExecutionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<PostureHistory | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { isPreviewMode, previewTarget } = usePreview();
  const queryClient = useQueryClient();

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

  const { data: executions = [], isLoading, refetch } = useQuery({
    queryKey: ['m365-posture-history', statusFilter, timeFilter, isPreviewMode, previewTarget?.workspaces],
    queryFn: async () => {
      const startTime = getTimeFilterDate();
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

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
      const hasActive = data?.some(e => e.status === 'running' || e.status === 'pending');
      return hasActive ? 10000 : false;
    },
  });

  // Fetch tenants for lookup
  const { data: tenants = [] } = useQuery({
    queryKey: ['m365-tenants-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_tenants')
        .select('id, tenant_domain, display_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch clients for lookup
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const hasActiveTasks = executions.some(e => e.status === 'running' || e.status === 'pending');

  const stats = useMemo(() => ({
    total: executions.length,
    pending: executions.filter(e => e.status === 'pending').length,
    running: executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length,
  }), [executions]);

  const getTenantLabel = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.display_name || tenant?.tenant_domain || tenantId.slice(0, 8) + '...';
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'N/A';
  };

  const filteredExecutions = executions.filter(exec => {
    if (!searchTerm) return true;
    const tenant = tenants.find(t => t.id === exec.tenant_record_id);
    const client = clients.find(c => c.id === exec.client_id);
    const s = searchTerm.toLowerCase();
    return (
      tenant?.display_name?.toLowerCase().includes(s) ||
      tenant?.tenant_domain?.toLowerCase().includes(s) ||
      client?.name?.toLowerCase().includes(s)
    );
  });

  const openDetails = (execution: PostureHistory) => {
    setSelectedExecution(execution);
    setDetailsOpen(true);
  };

  const getDuration = (exec: PostureHistory) => {
    if (!exec.started_at) return '-';
    const end = exec.completed_at ? new Date(exec.completed_at) : new Date();
    const start = new Date(exec.started_at);
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Execuções' },
        ]} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Execuções de Análise</h1>
            <p className="text-muted-foreground">Monitore as análises de postura de segurança M365</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("w-4 h-4 mr-2", hasActiveTasks && "animate-spin")} />
            {hasActiveTasks ? 'Atualizando...' : 'Atualizar'}
          </Button>
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
                    placeholder="Buscar por tenant ou workspace..."
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

        {/* Executions Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredExecutions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma execução encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExecutions.map(exec => {
                    const config = statusConfig[exec.status] || statusConfig.pending;
                    return (
                      <TableRow key={exec.id}>
                        <TableCell className="font-medium">
                          {getTenantLabel(exec.tenant_record_id)}
                        </TableCell>
                        <TableCell>{getClientName(exec.client_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('gap-1', config.color)}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {exec.status === 'completed' && exec.score !== null ? (
                            <Badge className={exec.score >= 70 ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500'}>
                              {exec.score}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getDuration(exec)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(exec.created_at), { locale: ptBR, addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openDetails(exec)}>
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
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Detalhes da Execução</DialogTitle>
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
      </div>
    </AppLayout>
  );
}
