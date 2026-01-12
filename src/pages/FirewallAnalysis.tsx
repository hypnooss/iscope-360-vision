import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/components/Dashboard';
import { ComplianceReport } from '@/types/compliance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FirewallAnalysis() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<ComplianceReport | null>(location.state?.report || null);
  const [firewall, setFirewall] = useState<{ name: string; fortigate_url: string; api_key: string } | null>(null);
  const [loading, setLoading] = useState(!location.state?.report);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchFirewall();
      if (!location.state?.report) {
        fetchLastAnalysis();
      }
    }
  }, [id, user]);

  const fetchFirewall = async () => {
    const { data } = await supabase
      .from('firewalls')
      .select('name, fortigate_url, api_key')
      .eq('id', id)
      .single();

    if (data) setFirewall(data);
  };

  const fetchLastAnalysis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('analysis_history')
      .select('report_data, created_at')
      .eq('firewall_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.report_data) {
      setReport({
        ...data.report_data as unknown as ComplianceReport,
        generatedAt: new Date(data.created_at),
      });
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    if (!firewall) return;

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortigate-compliance', {
        body: { url: firewall.fortigate_url, apiKey: firewall.api_key },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.details || data.error);

      // Save to history
      await supabase.from('analysis_history').insert({
        firewall_id: id,
        score: data.score,
        report_data: data,
        analyzed_by: user?.id,
      });

      // Update firewall
      await supabase.from('firewalls').update({
        last_analysis_at: new Date().toISOString(),
        last_score: data.score,
        serial_number: data.serialNumber,
      }).eq('id', id);

      setReport({
        ...data,
        generatedAt: new Date(data.generatedAt),
      });

      toast.success('Análise atualizada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = () => {
    navigate('/firewalls');
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <Button variant="ghost" onClick={() => navigate('/firewalls')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma análise encontrada para este firewall.</p>
            <p className="text-sm mt-2">Execute uma nova análise para ver os resultados.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-2">
        <Button variant="ghost" onClick={() => navigate('/firewalls')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Firewalls
        </Button>
        <Dashboard
          report={report}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onDisconnect={handleDisconnect}
        />
      </div>
    </AppLayout>
  );
}
