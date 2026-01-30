import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Eye, Loader2, AlertTriangle, CheckCircle, Filter, Globe } from 'lucide-react';
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
}

interface FilterOption {
  id: string;
  name: string;
}

interface GroupedDomain {
  domain_id: string;
  domain_name: string;
  domain_url: string;
  client_id: string;
  client_name: string;
  analyses: {
    id: string;
    score: number;
    created_at: string;
    report_data: any;
  }[];
}

export default function ExternalDomainReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const navigate = useNavigate();
  const [reports, setReports] = useState<DomainReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [domains, setDomains] = useState<FilterOption[]>([]);
  
  // State for selected analysis per domain
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, string>>({});

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
  }, [user, authLoading, moduleLoading, hasModuleAccess]);

  const fetchReports = async () => {
    try {
      const { data: historyData } = await supabase
        .from('external_domain_analysis_history')
        .select('id, domain_id, score, created_at')
        .order('created_at', { ascending: false });

      if (!historyData || historyData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const domainIds = [...new Set(historyData.map(h => h.domain_id))];
      const { data: domainsData } = await supabase
        .from('external_domains')
        .select('id, name, domain, client_id')
        .in('id', domainIds);

      const clientIds = [...new Set((domainsData || []).map(d => d.client_id))];
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      const domainMap = new Map((domainsData || []).map(d => [d.id, d]));
      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));

      setClients((clientsData || []).map(c => ({ id: c.id, name: c.name })));
      setDomains((domainsData || []).map(d => ({ id: d.id, name: d.name })));

      const formattedReports: DomainReport[] = historyData.map(h => {
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
        };
      });

      setReports(formattedReports);
    } catch (error) {
      console.error('Error fetching external domain reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Filtered reports based on selected filters
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesClient = selectedClient === 'all' || report.client_id === selectedClient;
      const matchesDomain = selectedDomain === 'all' || report.domain_id === selectedDomain;
      return matchesClient && matchesDomain;
    });
  }, [reports, selectedClient, selectedDomain]);

  // Group reports by domain
  const groupedDomains = useMemo(() => {
    const groups = new Map<string, GroupedDomain>();
    
    filteredReports.forEach(report => {
      if (!groups.has(report.domain_id)) {
        groups.set(report.domain_id, {
          domain_id: report.domain_id,
          domain_name: report.domain_name,
          domain_url: report.domain_url,
          client_id: report.client_id,
          client_name: report.client_name,
          analyses: [],
        });
      }
      
      groups.get(report.domain_id)!.analyses.push({
        id: report.id,
        score: report.score,
        created_at: report.created_at,
        report_data: report.report_data,
      });
    });
    
    // Sort analyses by date (most recent first)
    groups.forEach(group => {
      group.analyses.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    
    return Array.from(groups.values());
  }, [filteredReports]);

  // Initialize with most recent analysis for each domain
  useEffect(() => {
    const initial: Record<string, string> = {};
    groupedDomains.forEach(group => {
      if (group.analyses.length > 0 && !selectedAnalyses[group.domain_id]) {
        initial[group.domain_id] = group.analyses[0].id;
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedAnalyses(prev => ({ ...prev, ...initial }));
    }
  }, [groupedDomains]);

  // Filter domains by selected client
  const availableDomains = useMemo(() => {
    if (selectedClient === 'all') return domains;
    return domains.filter(d => {
      const report = reports.find(r => r.domain_id === d.id);
      return report?.client_id === selectedClient;
    });
  }, [domains, selectedClient, reports]);

  // Reset domain filter when client changes
  useEffect(() => {
    if (selectedClient !== 'all') {
      const currentDomainValid = availableDomains.some(d => d.id === selectedDomain);
      if (!currentDomainValid && selectedDomain !== 'all') {
        setSelectedDomain('all');
      }
    }
  }, [selectedClient, availableDomains, selectedDomain]);

  const getSelectedAnalysis = (group: GroupedDomain) => {
    const selectedId = selectedAnalyses[group.domain_id];
    return group.analyses.find(a => a.id === selectedId) || group.analyses[0];
  };

  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const fetchReportData = async (analysisId: string): Promise<{ reportData: any; createdAt: string; domainId: string } | null> => {
    const { data, error } = await supabase
      .from('external_domain_analysis_history')
      .select('report_data, created_at, domain_id')
      .eq('id', analysisId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching external domain report data:', error);
      toast.error('Erro ao carregar dados do relatório');
      return null;
    }

    if (!data?.report_data) return null;
    return {
      reportData: data.report_data,
      createdAt: data.created_at,
      domainId: data.domain_id,
    };
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
            client_name: group.client_name,
          },
        },
      });
    } finally {
      setLoadingReportId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-success/10 text-success';
    if (score >= 75) return 'bg-success/10 text-success';
    if (score >= 60) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
          { label: 'Relatórios' },
        ]} />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Histórico de verificações de domínios externos</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {clients.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {clients.length <= 1 && <Filter className="w-4 h-4 text-muted-foreground" />}
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os domínios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os domínios</SelectItem>
                {availableDomains.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reports Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Verificações
            </CardTitle>
            <CardDescription>
              {groupedDomains.length} domínio(s) com {filteredReports.length} verificação(ões) no total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : groupedDomains.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{reports.length === 0 ? 'Nenhum relatório disponível' : 'Nenhum relatório encontrado com os filtros selecionados'}</p>
                {reports.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/scope-external-domain/domains')}
                  >
                    Verificar Domínio
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Data</TableHead>
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
                              <p>{group.domain_name}</p>
                              <p className="text-xs text-muted-foreground">{group.domain_url}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {group.analyses.length} verificação(ões)
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{group.client_name}</TableCell>
                        <TableCell>
                          {currentAnalysis && (
                            <Badge className={getScoreColor(currentAnalysis.score)}>
                              <span className="flex items-center gap-1">
                                {currentAnalysis.score >= 80 ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {currentAnalysis.score}%
                              </span>
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={selectedAnalyses[group.domain_id] || group.analyses[0]?.id}
                            onValueChange={(value) => setSelectedAnalyses(prev => ({
                              ...prev,
                              [group.domain_id]: value
                            }))}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {group.analyses.map((analysis) => (
                                <SelectItem key={analysis.id} value={analysis.id}>
                                  {formatDate(analysis.created_at)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleViewReport(group)}
                               disabled={loadingReportId === currentAnalysis?.id}
                               title="Visualizar"
                             >
                               {loadingReportId === currentAnalysis?.id ? (
                                 <Loader2 className="w-4 h-4 animate-spin" />
                               ) : (
                                 <Eye className="w-4 h-4" />
                               )}
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
      </div>
    </AppLayout>
  );
}
