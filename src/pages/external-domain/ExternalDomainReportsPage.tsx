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
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Eye, Loader2, AlertTriangle, CheckCircle, Globe, Search, Building2, Activity, Clock, CheckCircle2, XCircle, Play, Download } from 'lucide-react';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { ExternalDomainPDF } from '@/components/pdf/ExternalDomainPDF';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DomainReport {
  id: string;
  domain_id: string;
  domain_name: string;
  domain_url: string;
  client_id: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data?: any;
  status: string;
  completed_at: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  manual: 'Manual',
};

const DAYS_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira',
  3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado',
};

const FREQUENCY_BADGE_STYLES: Record<string, string> = {
  daily:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  weekly:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  monthly: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  manual:  'bg-muted text-muted-foreground border-border',
};

interface GroupedDomain {
  domain_id: string;
  domain_name: string;
  domain_url: string;
  client_id: string;
  client_name: string;
  agent_id: string | null;
  schedule_frequency: string;
  schedule_hour: number;
  schedule_day_of_week: number;
  schedule_day_of_month: number;
  analyses: {
    id: string;
    score: number;
    created_at: string;
    report_data: any;
    status: string;
    completed_at: string | null;
  }[];
}

export default function ExternalDomainReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DomainReport[]>([]);
  const [domainsMeta, setDomainsMeta] = useState<{id: string;name: string;domain: string;client_id: string;agent_id: string | null;client_name: string;schedule_frequency: string;schedule_hour: number;schedule_day_of_week: number;schedule_day_of_month: number;}[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { downloadPDF } = usePDFDownload();

  const [search, setSearch] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  // State for selected analysis per domain
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, string>>({});

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // Fetch workspaces for super roles
  const { data: workspaces = [] } = useQuery({
    queryKey: ['compliance-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('clients').
      select('id, name').
      order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperRole
  });

  useEffect(() => {
    if (authLoading || moduleLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!hasModuleAccess('scope_external_domain')) {
      navigate('/modules');
    }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (!authLoading && !moduleLoading && user && hasModuleAccess('scope_external_domain')) {
      fetchReports();
    }
  }, [user, authLoading, moduleLoading, hasModuleAccess, isPreviewMode, previewTarget]);

  const fetchReports = async () => {
    try {
      const workspaceIds = isPreviewMode && previewTarget?.workspaces ?
      previewTarget.workspaces.map((w) => w.id) :
      null;

      // 1. Fetch all domains first (filtered by workspace)
      let domainsQuery = supabase.
      from('external_domains').
      select('id, name, domain, client_id, agent_id');

      if (workspaceIds && workspaceIds.length > 0) {
        domainsQuery = domainsQuery.in('client_id', workspaceIds);
      }

      const { data: domainsData, error: domainsError } = await domainsQuery;
      if (domainsError) throw domainsError;

      if (!domainsData || domainsData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const domainIds = domainsData.map((d) => d.id);

      // 2. Fetch history + schedules in parallel
      const [historyResult, schedulesResult, clientsResult] = await Promise.all([
        supabase
          .from('external_domain_analysis_history')
          .select('id, domain_id, score, created_at, status, completed_at')
          .in('domain_id', domainIds)
          .eq('source', 'agent')
          .order('created_at', { ascending: false }),
        supabase
          .from('external_domain_schedules')
          .select('domain_id, frequency, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month')
          .in('domain_id', domainIds)
          .eq('is_active', true),
        supabase
          .from('clients')
          .select('id, name')
          .in('id', [...new Set(domainsData.map((d) => d.client_id))]),
      ]);

      const historyData = historyResult.data;
      const schedulesData = schedulesResult.data;
      const clientsData = clientsResult.data;

      const domainMap = new Map(domainsData.map((d) => [d.id, d]));
      const clientMap = new Map((clientsData || []).map((c) => [c.id, c]));
      const scheduleMap = new Map((schedulesData || []).map((s) => [s.domain_id, s]));

      // Build reports from history
      const formattedReports: DomainReport[] = (historyData || []).map((h) => {
        const domain = domainMap.get(h.domain_id);
        const client = domain ? clientMap.get(domain.client_id) : null;
        return {
          id: h.id,
          domain_id: h.domain_id,
          domain_name: domain?.name || 'N/A',
          domain_url: domain?.domain || 'N/A',
          client_id: client?.id || '',
          client_name: client?.name || 'N/A',
          score: h.score,
          created_at: h.created_at,
          status: h.status,
          completed_at: h.completed_at
        };
      });

      setReports(formattedReports);

      // Store domain metadata including schedule frequency
      setDomainsMeta(domainsData.map((d) => ({
        id: d.id,
        name: d.name,
        domain: d.domain,
        client_id: d.client_id,
        agent_id: d.agent_id,
        client_name: clientMap.get(d.client_id)?.name || 'N/A',
        schedule_frequency: scheduleMap.get(d.id)?.frequency || 'manual',
        schedule_hour: scheduleMap.get(d.id)?.scheduled_hour ?? 2,
        schedule_day_of_week: scheduleMap.get(d.id)?.scheduled_day_of_week ?? 1,
        schedule_day_of_month: scheduleMap.get(d.id)?.scheduled_day_of_month ?? 1,
      })));
    } catch (error) {
      console.error('Error fetching external domain reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Group reports by domain with search + workspace filter, including domains without analyses
  const groupedDomains = useMemo(() => {
    // Filter domainsMeta by workspace
    const filteredMeta = selectedWorkspaceId ?
    domainsMeta.filter((d) => d.client_id === selectedWorkspaceId) :
    domainsMeta;

    // Filter reports by workspace
    const workspaceFiltered = selectedWorkspaceId ?
    reports.filter((r) => r.client_id === selectedWorkspaceId) :
    reports;

    const groups = new Map<string, GroupedDomain>();

    // First, seed all domains (including those without analyses)
    filteredMeta.forEach((d) => {
      if (!groups.has(d.id)) {
        groups.set(d.id, {
          domain_id: d.id,
          domain_name: d.name,
          domain_url: d.domain,
          client_id: d.client_id,
          client_name: d.client_name,
          agent_id: d.agent_id,
          schedule_frequency: d.schedule_frequency,
          schedule_hour: d.schedule_hour,
          schedule_day_of_week: d.schedule_day_of_week,
          schedule_day_of_month: d.schedule_day_of_month,
          analyses: []
        });
      }
    });

    // Then add analyses
    workspaceFiltered.forEach((report) => {
      if (!groups.has(report.domain_id)) {
        const meta = domainsMeta.find(d => d.id === report.domain_id);
        groups.set(report.domain_id, {
          domain_id: report.domain_id,
          domain_name: report.domain_name,
          domain_url: report.domain_url,
          client_id: report.client_id,
          client_name: report.client_name,
          agent_id: null,
          schedule_frequency: meta?.schedule_frequency || 'manual',
          schedule_hour: meta?.schedule_hour ?? 2,
          schedule_day_of_week: meta?.schedule_day_of_week ?? 1,
          schedule_day_of_month: meta?.schedule_day_of_month ?? 1,
          analyses: []
        });
      }

      groups.get(report.domain_id)!.analyses.push({
        id: report.id,
        score: report.score,
        created_at: report.created_at,
        report_data: report.report_data,
        status: report.status,
        completed_at: report.completed_at
      });
    });

    groups.forEach((group) => {
      group.analyses.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    const all = Array.from(groups.values());

    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((g) =>
    g.domain_url.toLowerCase().includes(q) ||
    g.domain_name.toLowerCase().includes(q) ||
    g.client_name.toLowerCase().includes(q)
    );
  }, [reports, domainsMeta, search, selectedWorkspaceId]);

  // Auto-select first workspace when list loads
  useEffect(() => {
    if (isSuperRole && workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, isSuperRole, selectedWorkspaceId]);

  // Stats cards data - based on latest analysis status per domain
  const stats = useMemo(() => {
    const total = groupedDomains.length;
    let pending = 0,running = 0,completed = 0,failed = 0;
    groupedDomains.forEach((g) => {
      const status = g.analyses[0]?.status;
      if (!status) return; // domain without analyses - don't count in status
      if (status === 'pending') pending++;else
      if (status === 'running') running++;else
      if (status === 'failed') failed++;else
      completed++;
    });
    return { total, pending, running, completed, failed };
  }, [groupedDomains]);

  // Initialize with most recent analysis for each domain
  useEffect(() => {
    const initial: Record<string, string> = {};
    groupedDomains.forEach((group) => {
      if (group.analyses.length > 0 && !selectedAnalyses[group.domain_id]) {
        initial[group.domain_id] = group.analyses[0].id;
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedAnalyses((prev) => ({ ...prev, ...initial }));
    }
  }, [groupedDomains]);

  const getSelectedAnalysis = (group: GroupedDomain) => {
    const selectedId = selectedAnalyses[group.domain_id];
    return group.analyses.find((a) => a.id === selectedId) || group.analyses[0];
  };

  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const fetchReportData = async (analysisId: string): Promise<{reportData: any;createdAt: string;domainId: string;} | null> => {
    const { data, error } = await supabase.
    from('external_domain_analysis_history').
    select('report_data, created_at, domain_id').
    eq('id', analysisId).
    maybeSingle();

    if (error) {
      console.error('Error fetching external domain report data:', error);
      toast.error('Erro ao carregar dados do relatório');
      return null;
    }

    if (!data?.report_data) return null;
    return {
      reportData: data.report_data,
      createdAt: data.created_at,
      domainId: data.domain_id
    };
  };

  const handleAnalyze = async (domainId: string, agentId: string | null) => {
    if (!agentId) {
      toast.error('Agent não configurado', {
        description: 'Configure um agent para este domínio antes de executar a análise.',
        duration: 8000
      });
      return;
    }

    setAnalyzingId(domainId);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-external-domain-analysis', {
        body: { domain_id: domainId }
      });

      if (error) {
        console.error('Trigger external domain analysis error:', error);
        toast.error('Erro ao agendar análise', {
          description: 'Não foi possível criar a tarefa de análise. Tente novamente.',
          duration: 8000
        });
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao agendar análise', {
          description: data?.message || 'Verifique a configuração do domínio.',
          duration: 10000
        });
        return;
      }

      toast.success('Análise agendada!', {
        description: 'O agent irá processar em breve. Acompanhe o status na página.',
        duration: 5000
      });

      await fetchReports();
    } catch (e: any) {
      console.error('Trigger external domain analysis exception:', e);
      toast.error('Erro inesperado', {
        description: e?.message || 'Ocorreu um erro ao agendar a análise.',
        duration: 8000
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleViewReport = async (group: GroupedDomain) => {
    const analysis = getSelectedAnalysis(group);
    if (!analysis) return;

    setLoadingReportId(analysis.id);
    try {
      const loaded = await fetchReportData(analysis.id);
      if (!loaded) return;

      navigate(`/scope-external-domain/domains/${group.domain_id}/report/${analysis.id}`, {
        state: {
          report: loaded.reportData,
          analysisCreatedAt: loaded.createdAt,
          domainMeta: {
            domain_id: group.domain_id,
            domain_name: group.domain_name,
            domain_url: group.domain_url,
            client_name: group.client_name
          }
        }
      });
    } finally {
      setLoadingReportId(null);
    }
  };

  const handleDownloadPDF = async (group: GroupedDomain) => {
    const analysis = getSelectedAnalysis(group);
    if (!analysis) return;

    setDownloadingId(analysis.id);
    try {
      const loaded = await fetchReportData(analysis.id);
      if (!loaded) return;

      const report = loaded.reportData as any;

      let logoBase64: string | undefined;
      try {
        const logoModule = await import('@/assets/logo-iscope.png');
        const logoUrl = logoModule.default;
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (logoErr) {
        console.warn('Could not load logo for PDF:', logoErr);
      }

      const filename = `iscope360-${sanitizePDFFilename(group.domain_url || 'domain')}-${getPDFDateString()}.pdf`;

      await downloadPDF(
        <ExternalDomainPDF
          report={{
            overallScore: report.overallScore ?? 0,
            totalChecks: report.totalChecks ?? 0,
            passed: report.passed ?? 0,
            failed: report.failed ?? 0,
            warnings: report.warnings ?? 0,
            categories: report.categories ?? [],
            generatedAt: loaded.createdAt,
          }}
          domainInfo={{
            name: group.domain_name,
            domain: group.domain_url,
            clientName: group.client_name,
          }}
          dnsSummary={report.dnsSummary}
          emailAuth={report.emailAuth}
          subdomainSummary={report.subdomainSummary}
          logoBase64={logoBase64}
          correctionGuides={[]}
        />,
        filename
      );
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao exportar PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 75) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    if (score >= 50) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-destructive/20 text-destructive border-destructive/30';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStatusBadge = (analysis: GroupedDomain['analyses'][0] | undefined) => {
    if (!analysis) return null;
    const status = analysis.status;
    if (status === 'pending') {
      return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">Pendente</Badge>;
    }
    if (status === 'running') {
      return (
        <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Loader2 className="w-3 h-3 animate-spin mr-1" />
          Executando
        </Badge>);

    }
    if (status === 'failed') {
      return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">Falha</Badge>;
    }
    // completed or other
    return (
      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 font-normal">
        {formatDate(analysis.completed_at || analysis.created_at)}
      </Badge>);

  };

  if (authLoading || moduleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>);

  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
        { label: 'Domínio Externo' },
        { label: 'Compliance' }]
        } />
        
        {/* Header with Workspace Selector */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
            <p className="text-muted-foreground">Visão consolidada das análises de compliance</p>
          </div>
          {isSuperRole && workspaces.length > 0 &&
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Todos os workspaces" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) =>
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              )}
                </SelectContent>
              </Select>
          }
        </div>

        {/* Stats Cards - Executions pattern */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.running}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
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
                  <p className="text-2xl font-bold text-foreground">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search only */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar domínio ou cliente..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)} />

          </div>
        </div>

        {/* Reports Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            {loading ?
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> :
            groupedDomains.length === 0 ?
            <div className="text-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{reports.length === 0 ? 'Nenhum relatório disponível' : 'Nenhum relatório encontrado com os filtros selecionados'}</p>
                {reports.length === 0 &&
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/environment')}>

                    Verificar Domínio
                  </Button>
              }
              </div> :

            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Último Score</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDomains.map((group) => {
                  const currentAnalysis = getSelectedAnalysis(group);

                  return (
                    <TableRow key={group.domain_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">{group.domain_url}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {group.analyses.length} análise(s)
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{group.client_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className={FREQUENCY_BADGE_STYLES[group.schedule_frequency] || FREQUENCY_BADGE_STYLES.manual}
                            >
                              {FREQUENCY_LABELS[group.schedule_frequency] || 'Manual'}
                            </Badge>
                            {group.schedule_frequency === 'daily' && (
                              <span className="text-xs text-muted-foreground">
                                às {String(group.schedule_hour).padStart(2, '0')}:00 UTC
                              </span>
                            )}
                            {group.schedule_frequency === 'weekly' && (
                              <span className="text-xs text-muted-foreground">
                                {DAYS_OF_WEEK_LABELS[group.schedule_day_of_week]} às {String(group.schedule_hour).padStart(2, '0')}:00 UTC
                              </span>
                            )}
                            {group.schedule_frequency === 'monthly' && (
                              <span className="text-xs text-muted-foreground">
                                Dia {group.schedule_day_of_month} às {String(group.schedule_hour).padStart(2, '0')}:00 UTC
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {currentAnalysis && currentAnalysis.score != null &&
                        <Badge variant="outline" className={getScoreBadgeClass(currentAnalysis.score)}>
                              <span className="flex items-center gap-1">
                                {currentAnalysis.score >= 75 ?
                            <CheckCircle className="w-3 h-3" /> :

                            <AlertTriangle className="w-3 h-3" />
                            }
                                {currentAnalysis.score}%
                              </span>
                            </Badge>
                        }
                        </TableCell>
                        <TableCell>
                          {group.analyses.length > 0 ?
                        <Select
                          value={selectedAnalyses[group.domain_id] || group.analyses[0]?.id}
                          onValueChange={(value) => setSelectedAnalyses((prev) => ({
                            ...prev,
                            [group.domain_id]: value
                          }))}>

                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {group.analyses.map((analysis) =>
                            <SelectItem key={analysis.id} value={analysis.id}>
                                    {formatDate(analysis.created_at)}
                                  </SelectItem>
                            )}
                              </SelectContent>
                            </Select> :

                        <span className="text-muted-foreground text-sm">—</span>
                        }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                             <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAnalyze(group.domain_id, group.agent_id)}
                            disabled={analyzingId === group.domain_id}
                            title="Analisar">

                               {analyzingId === group.domain_id ?
                            <Loader2 className="w-4 h-4 animate-spin" /> :

                            <Play className="w-4 h-4" />
                            }
                             </Button>
                             {currentAnalysis?.status === 'completed' && (
                               <>
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={() => handleViewReport(group)}
                                   disabled={loadingReportId === currentAnalysis?.id}
                                   title="Visualizar">
                                   {loadingReportId === currentAnalysis?.id ?
                                     <Loader2 className="w-4 h-4 animate-spin" /> :
                                     <Eye className="w-4 h-4" />
                                   }
                                 </Button>
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={() => handleDownloadPDF(group)}
                                   disabled={downloadingId === currentAnalysis?.id}
                                   title="Baixar PDF">
                                   {downloadingId === currentAnalysis?.id ?
                                     <Loader2 className="w-4 h-4 animate-spin" /> :
                                     <Download className="w-4 h-4" />
                                   }
                                 </Button>
                               </>
                             )}
                          </div>
                        </TableCell>
                      </TableRow>);

                })}
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>
      </div>
    </AppLayout>);

}