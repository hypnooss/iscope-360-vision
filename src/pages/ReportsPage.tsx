import { useEffect, useState, useMemo } from 'react';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Loader2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { FirewallPDF } from '@/components/pdf/FirewallPDF';

interface AnalysisHistoryItem {
  id: string;
  score: number;
  created_at: string;
  firewall_id: string;
  report_data?: any; // Carregado sob demanda
  firewalls?: {
    name: string;
    serial_number: string | null;
    clients?: { name: string; id: string };
  };
}

interface FilterOption {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();
  
  // Filter states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedFirewall, setSelectedFirewall] = useState<string>('all');
  const [clients, setClients] = useState<FilterOption[]>([]);
  const [firewalls, setFirewalls] = useState<FilterOption[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      // Fetch analysis history - SEM report_data para performance (carregado sob demanda)
      const { data: historyData, error: historyError } = await supabase
        .from('analysis_history')
        .select('id, score, created_at, firewall_id')
        .order('created_at', { ascending: false })
        .limit(100);

      if (historyError) throw historyError;

      if (!historyData || historyData.length === 0) {
        setHistory([]);
        setLoading(false);
        return;
      }

      // Get unique firewall IDs
      const firewallIds = [...new Set(historyData.map(a => a.firewall_id))];
      
      // Fetch firewalls
      const { data: firewallsData } = await supabase
        .from('firewalls')
        .select('id, name, serial_number, client_id')
        .in('id', firewallIds);

      // Get unique client IDs
      const clientIds = [...new Set((firewallsData || []).map(f => f.client_id))];
      
      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      // Create maps for quick lookup
      const firewallMap = new Map((firewallsData || []).map(f => [f.id, f]));
      const clientMap = new Map((clientsData || []).map(c => [c.id, c]));

      // Set filter options
      setClients((clientsData || []).map(c => ({ id: c.id, name: c.name })));
      setFirewalls((firewallsData || []).map(f => ({ id: f.id, name: f.name })));

      // Combine data
      const combined = historyData.map(item => {
        const firewall = firewallMap.get(item.firewall_id);
        const client = firewall ? clientMap.get(firewall.client_id) : null;
        return {
          ...item,
          firewalls: firewall ? {
            name: firewall.name,
            serial_number: firewall.serial_number,
            clients: client ? { name: client.name, id: client.id } : undefined,
          } : undefined,
        };
      });

      setHistory(combined);
    } catch (error: any) {
      toast.error('Erro ao carregar histórico: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtered history based on selected filters
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesClient = selectedClient === 'all' || item.firewalls?.clients?.id === selectedClient;
      const matchesFirewall = selectedFirewall === 'all' || item.firewall_id === selectedFirewall;
      return matchesClient && matchesFirewall;
    });
  }, [history, selectedClient, selectedFirewall]);

  // Filter firewalls by selected client
  const availableFirewalls = useMemo(() => {
    if (selectedClient === 'all') return firewalls;
    return firewalls.filter(fw => {
      const historyItem = history.find(h => h.firewall_id === fw.id);
      return historyItem?.firewalls?.clients?.id === selectedClient;
    });
  }, [firewalls, selectedClient, history]);

  // Reset firewall filter when client changes
  useEffect(() => {
    if (selectedClient !== 'all') {
      const currentFirewallValid = availableFirewalls.some(fw => fw.id === selectedFirewall);
      if (!currentFirewallValid && selectedFirewall !== 'all') {
        setSelectedFirewall('all');
      }
    }
  }, [selectedClient, availableFirewalls, selectedFirewall]);

  // Carregar report_data sob demanda
  const fetchReportData = async (analysisId: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from('analysis_history')
      .select('report_data')
      .eq('id', analysisId)
      .maybeSingle();
    
    if (error || !data) {
      toast.error('Erro ao carregar dados do relatório');
      return null;
    }
    return data.report_data;
  };

  const handleView = async (item: AnalysisHistoryItem) => {
    setLoadingReportId(item.id);
    try {
      let reportData = item.report_data;
      if (!reportData) {
        reportData = await fetchReportData(item.id);
        if (!reportData) return;
      }
      navigate(`/firewalls/${item.firewall_id}/analysis`, {
        state: { report: reportData },
      });
    } finally {
      setLoadingReportId(null);
    }
  };

  const handleExportPDF = async (item: AnalysisHistoryItem) => {
    setLoadingReportId(item.id);
    try {
      let reportData = item.report_data;
      if (!reportData) {
        reportData = await fetchReportData(item.id);
        if (!reportData) return;
      }
      
      const firewallName = item.firewalls?.name || 'firewall';
      const filename = `iscope360-${sanitizePDFFilename(firewallName)}-${getPDFDateString()}.pdf`;
      
      await downloadPDF(
        <FirewallPDF
          report={{
            ...reportData,
            generatedAt: new Date(item.created_at),
          }}
          deviceInfo={{
            name: firewallName,
          }}
        />,
        filename
      );
      toast.success('PDF exportado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao exportar PDF: ' + error.message);
    } finally {
      setLoadingReportId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-success/10 text-success'; // Excelente
    if (score >= 75) return 'bg-success/10 text-success'; // Bom
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

        {/* History Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Análises
            </CardTitle>
            <CardDescription>
              {filteredHistory.length} análise(s) {filteredHistory.length !== history.length && `de ${history.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{history.length === 0 ? 'Nenhuma análise registrada' : 'Nenhuma análise encontrada com os filtros selecionados'}</p>
                {history.length === 0 && (
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/firewalls')}>
                    Ir para Firewalls
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Firewall</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Checks</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.firewalls?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {item.firewalls?.clients?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.firewalls?.serial_number || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getScoreColor(item.score)}>
                          {item.score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        -
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(item)}
                            title="Ver relatório"
                            disabled={loadingReportId === item.id}
                          >
                            {loadingReportId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExportPDF(item)}
                            title="Exportar PDF"
                            disabled={loadingReportId === item.id}
                          >
                            {loadingReportId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
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
