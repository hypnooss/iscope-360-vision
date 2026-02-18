import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import {
  Eye, Loader2, AlertTriangle, CheckCircle, Search, Building2,
  Activity, Clock, CheckCircle2, XCircle, Play, Download, Server
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { FirewallPDF } from '@/components/pdf/FirewallPDF';

interface FirewallReport {
  id: string;
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data?: any;
}

interface GroupedFirewall {
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  agent_id: string | null;
  device_type_id: string | null;
  vendor_name: string | null;
  agent_name: string | null;
  schedule_frequency: string | null;
  analyses: {
    id: string;
    score: number;
    created_at: string;
    report_data: any;
  }[];
  // pending task status
  taskStatus?: string | null;
}

export default function FirewallReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const { downloadPDF } = usePDFDownload();

  const [reports, setReports] = useState<FirewallReport[]>([]);
  const [firewallsMeta, setFirewallsMeta] = useState<{
    id: string;
    name: string;
    client_id: string;
    agent_id: string | null;
    device_type_id: string | null;
    client_name: string;
    vendor_name: string | null;
    agent_name: string | null;
    schedule_frequency: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, string>>({});

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // Fetch workspaces for super roles
  const { data: workspaces = [] } = useQuery({
    queryKey: ['firewall-compliance-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperRole,
  });

  useEffect(() => {
    if (authLoading || moduleLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!hasModuleAccess('scope_firewall')) { navigate('/modules'); }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (!authLoading && !moduleLoading && user && hasModuleAccess('scope_firewall')) {
      fetchReports();
    }
  }, [user, authLoading, moduleLoading, hasModuleAccess, isPreviewMode, previewTarget]);

  // Auto-select first workspace for super roles
  useEffect(() => {
    if (isSuperRole && workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, isSuperRole, selectedWorkspaceId]);

  const fetchReports = async () => {
    try {
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      // 1. Fetch all firewalls
      let firewallsQuery = supabase
        .from('firewalls')
        .select('id, name, client_id, agent_id, device_type_id');

      if (workspaceIds && workspaceIds.length > 0) {
        firewallsQuery = firewallsQuery.in('client_id', workspaceIds);
      }

      const { data: firewallsData, error: firewallsError } = await firewallsQuery;
      if (firewallsError) throw firewallsError;

      if (!firewallsData || firewallsData.length === 0) {
        setReports([]);
        setFirewallsMeta([]);
        setLoading(false);
        return;
      }

      const firewallIds = firewallsData.map(f => f.id);

      // 2. Fetch analysis history, client names, device types, agents, schedules in parallel
      const clientIds = [...new Set(firewallsData.map(f => f.client_id))];
      const deviceTypeIds = [...new Set(firewallsData.map(f => f.device_type_id).filter(Boolean))] as string[];
      const agentIds = [...new Set(firewallsData.map(f => f.agent_id).filter(Boolean))] as string[];

      const [historyRes, clientsRes, deviceTypesRes, agentsRes, schedulesRes] = await Promise.all([
        supabase
          .from('analysis_history')
          .select('id, firewall_id, score, created_at')
          .in('firewall_id', firewallIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds),
        deviceTypeIds.length > 0
          ? supabase.from('device_types').select('id, vendor, name').in('id', deviceTypeIds)
          : Promise.resolve({ data: [] }),
        agentIds.length > 0
          ? supabase.from('agents').select('id, name').in('id', agentIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('analysis_schedules')
          .select('firewall_id, frequency')
          .in('firewall_id', firewallIds)
          .eq('is_active', true),
      ]);

      const historyData = historyRes.data;
      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
      const deviceTypeMap = new Map((deviceTypesRes.data || []).map(dt => [dt.id, dt]));
      const agentMap = new Map((agentsRes.data || []).map(a => [a.id, a]));
      const scheduleMap = new Map((schedulesRes.data || []).map(s => [s.firewall_id, s]));
      const firewallMap = new Map(firewallsData.map(f => [f.id, f]));

      // Build reports from history
      const formattedReports: FirewallReport[] = (historyData || []).map(h => {
        const fw = firewallMap.get(h.firewall_id);
        const client = fw ? clientMap.get(fw.client_id) : null;
        return {
          id: h.id,
          firewall_id: h.firewall_id,
          firewall_name: fw?.name || 'N/A',
          client_id: client?.id || '',
          client_name: client?.name || 'N/A',
          score: h.score,
          created_at: h.created_at,
        };
      });

      setReports(formattedReports);

      // Store firewall metadata (including those without history)
      setFirewallsMeta(firewallsData.map(f => ({
        id: f.id,
        name: f.name,
        client_id: f.client_id,
        agent_id: f.agent_id,
        device_type_id: f.device_type_id,
        client_name: clientMap.get(f.client_id)?.name || 'N/A',
        vendor_name: f.device_type_id ? (deviceTypeMap.get(f.device_type_id)?.vendor || null) : null,
        agent_name: f.agent_id ? (agentMap.get(f.agent_id)?.name || null) : null,
        schedule_frequency: scheduleMap.get(f.id)?.frequency || null,
      })));
    } catch (error) {
      console.error('Error fetching firewall compliance reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Group by firewall with workspace + search filter, seeding all firewalls
  const groupedFirewalls = useMemo(() => {
    const filteredMeta = selectedWorkspaceId
      ? firewallsMeta.filter(f => f.client_id === selectedWorkspaceId)
      : firewallsMeta;

    const workspaceFiltered = selectedWorkspaceId
      ? reports.filter(r => r.client_id === selectedWorkspaceId)
      : reports;

    const groups = new Map<string, GroupedFirewall>();

    // Seed all firewalls (even without analysis)
    filteredMeta.forEach(f => {
      if (!groups.has(f.id)) {
        groups.set(f.id, {
          firewall_id: f.id,
          firewall_name: f.name,
          client_id: f.client_id,
          client_name: f.client_name,
          agent_id: f.agent_id,
          device_type_id: f.device_type_id,
          vendor_name: f.vendor_name,
          agent_name: f.agent_name,
          schedule_frequency: f.schedule_frequency,
          analyses: [],
        });
      }
    });

    // Add analyses
    workspaceFiltered.forEach(report => {
      if (!groups.has(report.firewall_id)) {
        groups.set(report.firewall_id, {
          firewall_id: report.firewall_id,
          firewall_name: report.firewall_name,
          client_id: report.client_id,
          client_name: report.client_name,
          agent_id: null,
          device_type_id: null,
          vendor_name: null,
          agent_name: null,
          schedule_frequency: null,
          analyses: [],
        });
      }
      groups.get(report.firewall_id)!.analyses.push({
        id: report.id,
        score: report.score,
        created_at: report.created_at,
        report_data: report.report_data,
      });
    });

    groups.forEach(group => {
      group.analyses.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    const all = Array.from(groups.values());

    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(g =>
      g.firewall_name.toLowerCase().includes(q) ||
      g.client_name.toLowerCase().includes(q)
    );
  }, [reports, firewallsMeta, search, selectedWorkspaceId]);

  // Stats
  const stats = useMemo(() => {
    const total = groupedFirewalls.length;
    let withAnalysis = 0, without = 0;
    groupedFirewalls.forEach(g => {
      if (g.analyses.length > 0) withAnalysis++; else without++;
    });
    return { total, withAnalysis, without };
  }, [groupedFirewalls]);

  // Initialize selected analysis per firewall
  useEffect(() => {
    const initial: Record<string, string> = {};
    groupedFirewalls.forEach(group => {
      if (group.analyses.length > 0 && !selectedAnalyses[group.firewall_id]) {
        initial[group.firewall_id] = group.analyses[0].id;
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedAnalyses(prev => ({ ...prev, ...initial }));
    }
  }, [groupedFirewalls]);

  const getSelectedAnalysis = (group: GroupedFirewall) => {
    const selectedId = selectedAnalyses[group.firewall_id];
    return group.analyses.find(a => a.id === selectedId) || group.analyses[0];
  };

  const handleAnalyze = async (firewallId: string, agentId: string | null, deviceTypeId: string | null) => {
    if (!agentId) {
      toast.error('Agent não configurado', {
        description: 'Configure um agent para este firewall antes de executar a análise.',
        duration: 8000,
      });
      return;
    }
    if (!deviceTypeId) {
      toast.error('Tipo de dispositivo não configurado', {
        description: 'Configure o tipo de dispositivo para este firewall.',
        duration: 8000,
      });
      return;
    }

    setAnalyzingId(firewallId);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-firewall-analysis', {
        body: { firewall_id: firewallId },
      });

      if (error) {
        toast.error('Erro ao agendar análise', {
          description: 'Não foi possível criar a tarefa. Tente novamente.',
          duration: 8000,
        });
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao agendar análise', {
          description: data?.message || 'Verifique a configuração do firewall.',
          duration: 10000,
        });
        return;
      }

      toast.success('Análise agendada!', {
        description: 'O agent irá processar em breve.',
        duration: 5000,
      });

      await fetchReports();
    } catch (e: any) {
      toast.error('Erro inesperado', {
        description: e?.message || 'Ocorreu um erro ao agendar a análise.',
        duration: 8000,
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const fetchReportData = async (analysisId: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from('analysis_history')
      .select('report_data')
      .eq('id', analysisId)
      .maybeSingle();
    if (error) {
      toast.error('Erro ao carregar dados do relatório');
      return null;
    }
    return data?.report_data;
  };

  const handleViewReport = async (group: GroupedFirewall) => {
    const analysis = getSelectedAnalysis(group);
    if (!analysis) return;
    setLoadingReportId(analysis.id);
    try {
      const reportData = await fetchReportData(analysis.id);
      if (reportData) {
        navigate(`/scope-firewall/firewalls/${group.firewall_id}/analysis`, {
          state: { report: reportData },
        });
      }
    } finally {
      setLoadingReportId(null);
    }
  };

  const handleDownloadPDF = async (group: GroupedFirewall) => {
    const analysis = getSelectedAnalysis(group);
    if (!analysis) return;
    setLoadingReportId(analysis.id);
    try {
      const reportData = await fetchReportData(analysis.id);
      if (reportData) {
        const filename = `iscope360-${sanitizePDFFilename(group.firewall_name)}-${getPDFDateString()}.pdf`;
        await downloadPDF(
          <FirewallPDF
            report={{ ...reportData, generatedAt: new Date(analysis.created_at) }}
            deviceInfo={{ name: group.firewall_name }}
          />,
          filename
        );
        toast.success('PDF exportado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao exportar PDF');
    } finally {
      setLoadingReportId(null);
    }
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 75) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    if (score >= 50) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-destructive/20 text-destructive border-destructive/30';
  };

  const frequencyLabel = (freq: string) => {
    const map: Record<string, string> = {
      daily: 'Diário',
      weekly: 'Semanal',
      monthly: 'Mensal',
      manual: 'Manual',
    };
    return map[freq] || freq;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (authLoading || moduleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Firewall', href: '/scope-firewall/dashboard' },
          { label: 'Compliance' },
        ]} />

        {/* Header with Workspace Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
            <p className="text-muted-foreground">Visão consolidada das análises de compliance</p>
          </div>
          {isSuperRole && workspaces.length > 0 && (
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger className="w-[220px]">
                <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecionar workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.withAnalysis}</p>
                  <p className="text-xs text-muted-foreground">Com análise</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.without}</p>
                  <p className="text-xs text-muted-foreground">Sem análise</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar firewall ou workspace..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : groupedFirewalls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{firewallsMeta.length === 0 ? 'Nenhum firewall disponível' : 'Nenhum firewall encontrado com os filtros selecionados'}</p>
                {firewallsMeta.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/scope-firewall/firewalls')}
                  >
                    Ver Firewalls
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firewall</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Último Score</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedFirewalls.map(group => {
                    const currentAnalysis = getSelectedAnalysis(group);
                    return (
                      <TableRow key={group.firewall_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{group.firewall_name}</p>
                            <Badge variant="secondary" className="text-xs">
                              {group.analyses.length} análise(s)
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{group.client_name}</TableCell>
                        <TableCell>
                          {group.vendor_name ? (
                            <Badge variant="outline" className="text-xs">{group.vendor_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.agent_name ? (
                            <Badge variant="outline" className="text-xs font-mono">{group.agent_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.schedule_frequency ? (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {frequencyLabel(group.schedule_frequency)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Manual</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {currentAnalysis && currentAnalysis.score != null ? (
                            <Badge variant="outline" className={getScoreBadgeClass(currentAnalysis.score)}>
                              <span className="flex items-center gap-1">
                                {currentAnalysis.score >= 75 ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {currentAnalysis.score}%
                              </span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                              Sem análise
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.analyses.length > 0 ? (
                            <Select
                              value={selectedAnalyses[group.firewall_id] || group.analyses[0]?.id}
                              onValueChange={value => setSelectedAnalyses(prev => ({
                                ...prev,
                                [group.firewall_id]: value,
                              }))}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {group.analyses.map(analysis => (
                                  <SelectItem key={analysis.id} value={analysis.id}>
                                    {formatDate(analysis.created_at)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAnalyze(group.firewall_id, group.agent_id, group.device_type_id)}
                              disabled={analyzingId === group.firewall_id}
                              title="Analisar"
                            >
                              {analyzingId === group.firewall_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            {currentAnalysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewReport(group)}
                                disabled={loadingReportId === currentAnalysis.id}
                                title="Visualizar"
                              >
                                {loadingReportId === currentAnalysis.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                            {currentAnalysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownloadPDF(group)}
                                disabled={loadingReportId === currentAnalysis.id}
                                title="Baixar PDF"
                              >
                                <Download className="w-4 h-4" />
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
      </div>
    </AppLayout>
  );
}
