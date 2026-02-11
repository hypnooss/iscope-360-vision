import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Loader2, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { FirewallPDF } from '@/components/pdf/FirewallPDF';

interface AnalysisReport {
  id: string;
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data?: any; // Carregado sob demanda
}

interface FilterOption {
  id: string;
  name: string;
}

interface GroupedFirewall {
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  analyses: {
    id: string;
    score: number;
    created_at: string;
    report_data: any;
  }[];
}

export default function FirewallReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const navigate = useNavigate();
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { downloadPDF } = usePDFDownload();
  
  // Filter states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedFirewall, setSelectedFirewall] = useState<string>('all');
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [firewalls, setFirewalls] = useState<FilterOption[]>([]);
  
  // State for selected analysis per firewall
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading || moduleLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (!hasModuleAccess('scope_firewall')) {
      navigate('/modules');
    }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (!authLoading && !moduleLoading && user && hasModuleAccess('scope_firewall')) {
      fetchReports();
    }
  }, [user, authLoading, moduleLoading, isPreviewMode, previewTarget]);

  const fetchReports = async () => {
    try {
      // Get workspace IDs to filter by (for preview mode)
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      // Fetch analysis history - only lightweight fields for listing
      const { data: historyData } = await supabase
        .from('analysis_history')
        .select('id, firewall_id, score, created_at')
        .order('created_at', { ascending: false });

      if (!historyData || historyData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Get firewall info
      const firewallIds = [...new Set(historyData.map(h => h.firewall_id))];
      let firewallsQuery = supabase
        .from('firewalls')
        .select('id, name, client_id')
        .in('id', firewallIds);
      
      // Filter by workspaces in preview mode
      if (workspaceIds && workspaceIds.length > 0) {
        firewallsQuery = firewallsQuery.in('client_id', workspaceIds);
      }
      
      const { data: firewallsData } = await firewallsQuery;

      // Get client info
      const clientIds = [...new Set((firewallsData || []).map(f => f.client_id))];
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      const firewallMap = new Map((firewallsData || []).map(f => [f.id, f]));
      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));

      // Set filter options
      setClients((clientsData || []).map(c => ({ id: c.id, name: c.name })));
      setFirewalls((firewallsData || []).map(f => ({ id: f.id, name: f.name })));

      // Filter history to only include accessible firewalls
      const accessibleFirewallIds = new Set((firewallsData || []).map(f => f.id));
      const filteredHistory = historyData.filter(h => accessibleFirewallIds.has(h.firewall_id));

      const formattedReports: AnalysisReport[] = filteredHistory.map(h => {
        const firewall = firewallMap.get(h.firewall_id);
        const client = firewall ? clientMap.get(firewall.client_id) : null;
        return {
          id: h.id,
          firewall_id: h.firewall_id,
          firewall_name: firewall?.name || 'N/A',
          client_id: client?.id || '',
          client_name: client?.name || 'N/A',
          score: h.score,
          created_at: h.created_at,
          // report_data será carregado sob demanda
        };
      });

      setReports(formattedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  // Filtered reports based on selected filters
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesClient = selectedClient === 'all' || report.client_id === selectedClient;
      const matchesFirewall = selectedFirewall === 'all' || report.firewall_id === selectedFirewall;
      return matchesClient && matchesFirewall;
    });
  }, [reports, selectedClient, selectedFirewall]);

  // Group reports by firewall
  const groupedFirewalls = useMemo(() => {
    const groups = new Map<string, GroupedFirewall>();
    
    filteredReports.forEach(report => {
      if (!groups.has(report.firewall_id)) {
        groups.set(report.firewall_id, {
          firewall_id: report.firewall_id,
          firewall_name: report.firewall_name,
          client_id: report.client_id,
          client_name: report.client_name,
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
    
    // Sort analyses by date (most recent first)
    groups.forEach(group => {
      group.analyses.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    
    return Array.from(groups.values());
  }, [filteredReports]);

  // Initialize with most recent analysis for each firewall
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

  // Filter firewalls by selected client
  const availableFirewalls = useMemo(() => {
    if (selectedClient === 'all') return firewalls;
    return firewalls.filter(fw => {
      const report = reports.find(r => r.firewall_id === fw.id);
      return report?.client_id === selectedClient;
    });
  }, [firewalls, selectedClient, reports]);

  // Reset firewall filter when client changes
  useEffect(() => {
    if (selectedClient !== 'all') {
      const currentFirewallValid = availableFirewalls.some(fw => fw.id === selectedFirewall);
      if (!currentFirewallValid && selectedFirewall !== 'all') {
        setSelectedFirewall('all');
      }
    }
  }, [selectedClient, availableFirewalls, selectedFirewall]);

  const getSelectedAnalysis = (group: GroupedFirewall) => {
    const selectedId = selectedAnalyses[group.firewall_id];
    return group.analyses.find(a => a.id === selectedId) || group.analyses[0];
  };

  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const fetchReportData = async (analysisId: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from('analysis_history')
      .select('report_data')
      .eq('id', analysisId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching report data:', error);
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
          state: { report: reportData } 
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
            report={{
              ...reportData,
              generatedAt: new Date(analysis.created_at),
            }}
            deviceInfo={{
              name: group.firewall_name,
            }}
          />,
          filename
        );
        toast.success('PDF exportado com sucesso!');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
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
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Firewall', href: '/scope-firewall/dashboard' },
          { label: 'Relatórios' },
        ]} />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Histórico de análises de compliance</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
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
            <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os devices</SelectItem>
                {availableFirewalls.map(fw => (
                  <SelectItem key={fw.id} value={fw.id}>
                    {fw.name}
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
              Histórico de Análises
            </CardTitle>
            <CardDescription>
              {groupedFirewalls.length} firewall(s) com {filteredReports.length} análise(s) no total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : groupedFirewalls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{reports.length === 0 ? 'Nenhum relatório disponível' : 'Nenhum relatório encontrado com os filtros selecionados'}</p>
                {reports.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/scope-firewall/firewalls')}
                  >
                    Analisar Firewall
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firewall</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedFirewalls.map((group) => {
                    const currentAnalysis = getSelectedAnalysis(group);
                    
                    return (
                      <TableRow key={group.firewall_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {group.firewall_name}
                            <Badge variant="secondary" className="text-xs">
                              {group.analyses.length} análise(s)
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
                            value={selectedAnalyses[group.firewall_id] || group.analyses[0]?.id}
                            onValueChange={(value) => setSelectedAnalyses(prev => ({
                              ...prev,
                              [group.firewall_id]: value
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(group)}
                              disabled={loadingReportId === currentAnalysis?.id}
                              title="Baixar PDF"
                            >
                              <Download className="w-4 h-4" />
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
