import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Play, Trash2, Loader2, Pencil, Building2, Search, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  AddExternalDomainDialog,
  type AddExternalDomainPayload,
  type ScheduleFrequency,
} from '@/components/external-domain/AddExternalDomainDialog';
import { DeleteExternalDomainDialog } from '@/components/external-domain/DeleteExternalDomainDialog';

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
}

interface ExternalDomainRow {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  status: string;
  last_scan_at: string | null;
  last_score: number | null;
  client_id: string;
  agent_id: string | null;
  client_name?: string;
  agent_name?: string | null;
  schedule_frequency: ScheduleFrequency | 'manual';
  created_at: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  manual: 'Manual',
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const getScoreColor = (score: number | null) => {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
};

export default function ExternalDomainListPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<ExternalDomainRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<ExternalDomainRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Workspace selector for super roles
  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Fetch workspaces for super roles
  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select first workspace
  useEffect(() => {
    if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(allWorkspaces[0].id);
    }
  }, [isSuperRole, allWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!authLoading && user && !hasModuleAccess('scope_external_domain')) {
      navigate('/modules');
    }
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (user && hasModuleAccess('scope_external_domain')) {
      // Super roles must wait for workspace selection before fetching
      if (isSuperRole && !isPreviewMode && !selectedWorkspaceId) return;
      fetchData();
    }
  }, [user, isPreviewMode, previewTarget, selectedWorkspaceId, isSuperRole]);

  const fetchData = async () => {
    try {
      setLoading(true);

      let workspaceIds: string[] | null = null;
      if (isPreviewMode && previewTarget?.workspaces) {
        workspaceIds = previewTarget.workspaces.map(w => w.id);
      } else if (isSuperRole && selectedWorkspaceId) {
        workspaceIds = [selectedWorkspaceId];
      }

      let clientsQuery = supabase.from('clients').select('id, name').order('name');
      let domainsQuery = supabase.from('external_domains').select('*').order('created_at', { ascending: false });
      let agentsQuery = supabase.from('agents').select('id, name').eq('revoked', false);
      
      if (workspaceIds && workspaceIds.length > 0) {
        clientsQuery = clientsQuery.in('id', workspaceIds);
        domainsQuery = domainsQuery.in('client_id', workspaceIds);
        agentsQuery = agentsQuery.in('client_id', workspaceIds);
      }

      const [clientsRes, domainsRes, agentsRes] = await Promise.all([
        clientsQuery,
        domainsQuery,
        agentsQuery,
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (domainsRes.error) throw domainsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setClients(clientsRes.data || []);

      if (!domainsRes.data || domainsRes.data.length === 0) {
        setDomains([]);
        return;
      }

      const domainIds = domainsRes.data.map((d) => d.id);
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('external_domain_schedules')
        .select('domain_id, frequency, is_active')
        .in('domain_id', domainIds);

      if (schedulesError) throw schedulesError;

      const clientMap = new Map((clientsRes.data || []).map((c) => [c.id, c]));
      const agentMap = new Map((agentsRes.data || []).map((a: Agent) => [a.id, a]));
      const scheduleMap = new Map<string, { frequency: ScheduleFrequency; is_active: boolean }[]>();

      for (const schedule of schedulesData || []) {
        const existing = scheduleMap.get(schedule.domain_id) || [];
        existing.push({
          frequency: schedule.frequency as ScheduleFrequency,
          is_active: schedule.is_active,
        });
        scheduleMap.set(schedule.domain_id, existing);
      }

      const combined: ExternalDomainRow[] = (domainsRes.data || []).map((d) => {
        const schedules = scheduleMap.get(d.id) || [];
        const activeSchedule = schedules.find((s) => s.is_active) || schedules[0];

        return {
          id: d.id,
          name: d.name,
          domain: d.domain,
          description: d.description,
          status: d.status,
          last_scan_at: d.last_scan_at,
          last_score: d.last_score,
          client_id: d.client_id,
          agent_id: d.agent_id,
          client_name: clientMap.get(d.client_id)?.name,
          agent_name: d.agent_id ? agentMap.get(d.agent_id)?.name || null : null,
          schedule_frequency: activeSchedule?.frequency || 'manual',
          created_at: d.created_at,
        };
      });

      setDomains(combined);
    } catch (error: any) {
      console.error('Error fetching external domains:', error);
      toast.error('Erro ao carregar domínios', { description: error?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (payload: AddExternalDomainPayload) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    if (!payload.client_id || !payload.agent_id || !payload.domain.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      throw new Error('Campos obrigatórios não preenchidos');
    }

    const name = payload.domain.trim();

    const { data: inserted, error: insertError } = await supabase
      .from('external_domains')
      .insert({
        client_id: payload.client_id,
        agent_id: payload.agent_id || null,
        domain: payload.domain.trim(),
        name,
        description: null,
        created_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      toast.error('Erro ao adicionar domínio: ' + insertError.message);
      throw insertError;
    }

    if (payload.schedule !== 'manual') {
      const { error: scheduleError } = await supabase
        .from('external_domain_schedules')
        .insert({
          domain_id: inserted.id,
          frequency: payload.schedule,
          is_active: true,
          created_by: user.id,
        });

      if (scheduleError) {
        toast.error('Domínio criado, mas falhou ao salvar frequência', { description: scheduleError.message });
        throw scheduleError;
      }
    }

    await fetchData();
    toast.success('Domínio adicionado com sucesso!');
  };

  const handleAnalyze = async (domain: ExternalDomainRow) => {
    if (!domain.agent_id) {
      toast.error('Agent não configurado', {
        description: 'Configure um agent para este domínio antes de executar a análise.',
        duration: 8000,
      });
      return;
    }

    setAnalyzing(domain.id);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-external-domain-analysis', {
        body: { domain_id: domain.id },
      });

      if (error) {
        console.error('Trigger external domain analysis error:', error);
        toast.error('Erro ao agendar análise', {
          description: 'Não foi possível criar a tarefa de análise. Tente novamente.',
          duration: 8000,
        });
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao agendar análise', {
          description: data?.message || 'Verifique a configuração do domínio.',
          duration: 10000,
        });
        return;
      }

      toast.success('Análise agendada!', {
        description: 'O agent irá processar em breve. Acompanhe o status na página.',
        duration: 5000,
      });
    } catch (e: any) {
      console.error('Trigger external domain analysis exception:', e);
      toast.error('Erro inesperado', {
        description: e?.message || 'Ocorreu um erro ao agendar a análise.',
        duration: 8000,
      });
    } finally {
      setAnalyzing(null);
    }
  };

  const openEditPage = (domain: ExternalDomainRow) => {
    navigate(`/scope-external-domain/domains/${domain.id}/edit`);
  };

  const handleDeleteDomain = async (domain: ExternalDomainRow) => {
    setDeleting(true);
    try {
      const { error: deleteTasksError } = await supabase
        .from('agent_tasks')
        .delete()
        .eq('target_type', 'external_domain')
        .eq('target_id', domain.id)
        .in('status', ['pending', 'running']);

      if (deleteTasksError) throw deleteTasksError;

      const { error: deleteDomainError } = await supabase
        .from('external_domains')
        .delete()
        .eq('id', domain.id);

      if (deleteDomainError) throw deleteDomainError;

      await fetchData();
      setDeletingDomain(null);
      toast.success('Domínio excluído com sucesso!');
    } catch (error: any) {
      console.error('Error deleting external domain:', error);
      toast.error('Erro ao excluir domínio', { description: error?.message });
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = hasPermission('external_domain', 'edit');

  // Inline stats
  const stats = useMemo(() => {
    const total = domains.length;
    const withScore = domains.filter((d) => d.last_score !== null);
    const avg = withScore.length > 0
      ? Math.round(withScore.reduce((s, d) => s + (d.last_score || 0), 0) / withScore.length)
      : 0;
    const critical = domains.filter((d) => d.last_score !== null && (d.last_score as number) < 50).length;
    const failures = domains.filter((d) => d.last_score !== null && (d.last_score as number) < 30).length;
    return { total, avg, critical, failures };
  }, [domains]);

  // Search filter
  const filtered = useMemo(() => {
    if (!search) return domains;
    const q = search.toLowerCase();
    return domains.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.domain.toLowerCase().includes(q) ||
      d.client_name?.toLowerCase().includes(q)
    );
  }, [domains, search]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
          { label: 'Domínios' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Domínios Externos</h1>
            <p className="text-muted-foreground">Gerencie e monitore seus domínios externos</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && !isPreviewMode && allWorkspaces && allWorkspaces.length > 0 && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canEdit && (
              <AddExternalDomainDialog clients={clients} onDomainAdded={handleAddDomain} />
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : stats.total}</p>
                  <p className="text-xs text-muted-foreground">Domínios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.avg >= 75 ? 'bg-emerald-500/10' : stats.avg >= 60 ? 'bg-yellow-500/10' : 'bg-rose-500/10'}`}>
                  <TrendingUp className={`w-5 h-5 ${stats.avg >= 75 ? 'text-emerald-400' : stats.avg >= 60 ? 'text-yellow-400' : 'text-rose-400'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : `${stats.avg}%`}</p>
                  <p className="text-xs text-muted-foreground">Score Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : stats.critical}</p>
                  <p className="text-xs text-muted-foreground">Alertas Críticos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <Shield className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : stats.failures}</p>
                  <p className="text-xs text-muted-foreground">Falhas Críticas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
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
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum domínio encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Último Score</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const freq = d.schedule_frequency || 'manual';

                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">
                          {d.domain}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.client_name || '—'}
                        </TableCell>
                        <TableCell>
                          {d.agent_name ? (
                            <Badge variant="outline" className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30">
                              {d.agent_name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={FREQUENCY_COLORS[freq] || ''}>
                            {FREQUENCY_LABELS[freq] || freq}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.last_score !== null && d.last_score !== undefined ? (
                            <Badge variant="outline" className={getScoreColor(d.last_score)}>
                              {d.last_score}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAnalyze(d)}
                              disabled={analyzing === d.id}
                              title="Analisar"
                            >
                              {analyzing === d.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPage(d)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingDomain(d)}
                                  title="Excluir"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
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

        <DeleteExternalDomainDialog
          open={!!deletingDomain}
          onOpenChange={(open) => {
            if (!open) setDeletingDomain(null);
          }}
          domain={deletingDomain}
          onConfirm={handleDeleteDomain}
          loading={deleting}
        />
      </div>
    </AppLayout>
  );
}
