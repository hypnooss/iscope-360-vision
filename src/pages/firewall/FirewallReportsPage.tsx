import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AnalysisReport {
  id: string;
  firewall_id: string;
  firewall_name: string;
  client_name: string;
  score: number;
  created_at: string;
  report_data: any;
}

export default function FirewallReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);

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

      const formattedReports: AnalysisReport[] = historyData.map(h => {
        const firewall = firewallMap.get(h.firewall_id);
        const client = firewall ? clientMap.get(firewall.client_id) : null;
        return {
          id: h.id,
          firewall_id: h.firewall_id,
          firewall_name: firewall?.name || 'N/A',
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

  const handleViewReport = (report: AnalysisReport) => {
    navigate(`/scope-firewall/firewalls/${report.firewall_id}/analysis`, { 
      state: { report: report.report_data } 
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-success/10 text-success';
    if (score >= 60) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
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

        {/* Reports Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Análises
            </CardTitle>
            <CardDescription>
              {reports.length} análise(s) registrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório disponível</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/scope-firewall/firewalls')}
                >
                  Analisar Firewall
                </Button>
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
                  {reports.map((report) => (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewReport(report)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
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
