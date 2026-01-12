import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AnalysisHistoryItem {
  id: string;
  score: number;
  created_at: string;
  firewall_id: string;
  report_data: any;
  firewalls?: {
    name: string;
    serial_number: string | null;
    clients?: { name: string };
  };
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data, error } = await supabase
        .from('analysis_history')
        .select(`
          id,
          score,
          created_at,
          firewall_id,
          report_data,
          firewalls(name, serial_number, clients(name))
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistory(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar histórico: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (item: AnalysisHistoryItem) => {
    navigate(`/firewalls/${item.firewall_id}/analysis`, {
      state: { report: item.report_data },
    });
  };

  const handleExportPDF = async (item: AnalysisHistoryItem) => {
    try {
      const { exportReportToPDF } = await import('@/utils/pdfExport');
      exportReportToPDF({
        ...item.report_data,
        generatedAt: new Date(item.created_at),
      });
      toast.success('PDF exportado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao exportar PDF: ' + error.message);
    }
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

        {/* History Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Análises
            </CardTitle>
            <CardDescription>{history.length} análise(s) registrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma análise registrada</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/firewalls')}>
                  Ir para Firewalls
                </Button>
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
                  {history.map((item) => (
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
                        {item.report_data?.passed || 0}/{item.report_data?.totalChecks || 0} aprovados
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(item)}
                            title="Ver relatório"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExportPDF(item)}
                            title="Exportar PDF"
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
