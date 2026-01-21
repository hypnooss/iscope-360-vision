import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Loader2, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { exportReportToPDF } from '@/utils/pdfExport';

interface AnalysisReport {
  id: string;
  firewall_id: string;
  firewall_name: string;
  client_id: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data: any;
}

interface FilterOption {
  id: string;
  name: string;
}

export default function FirewallReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedFirewall, setSelectedFirewall] = useState<string>('all');
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [firewalls, setFirewalls] = useState<FilterOption[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) {
      navigate('/modules');
    }
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    if (user && hasModuleAccess('scope_firewall')) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    try {
      // Fetch analysis history
      const { data: historyData } = await supabase
        .from('analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!historyData || historyData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Get firewall info
      const firewallIds = [...new Set(historyData.map(h => h.firewall_id))];
      const { data: firewallsData } = await supabase
        .from('firewalls')
        .select('id, name, client_id')
        .in('id', firewallIds);

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

      const formattedReports: AnalysisReport[] = historyData.map(h => {
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
          report_data: h.report_data,
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

  const handleViewReport = (report: AnalysisReport) => {
    navigate(`/scope-firewall/firewalls/${report.firewall_id}/analysis`, { 
      state: { report: report.report_data } 
    });
  };

  const handleDownloadPDF = (report: AnalysisReport) => {
    try {
      const reportData = {
        ...report.report_data,
        generatedAt: new Date(report.created_at),
      };
      exportReportToPDF(reportData);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-success/10 text-success'; // Excelente
    if (score >= 75) return 'bg-success/10 text-success'; // Bom (verde mais claro)
    if (score >= 60) return 'bg-warning/10 text-warning'; // Atenção
    return 'bg-destructive/10 text-destructive'; // Risco Alto
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Histórico de análises de compliance</p>
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
              {filteredReports.length} análise(s) {filteredReports.length !== reports.length && `de ${reports.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredReports.length === 0 ? (
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
                    <TableHead>Cliente</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.firewall_name}</TableCell>
                      <TableCell>{report.client_name}</TableCell>
                      <TableCell>
                        <Badge className={getScoreColor(report.score)}>
                          <span className="flex items-center gap-1">
                            {report.score >= 80 ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {report.score}%
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewReport(report)}
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(report)}
                            title="Baixar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
