import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Server, AlertTriangle, CheckCircle, Clock, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RecentAnalysis {
  id: string;
  firewall_name: string;
  client_name: string;
  score: number;
  created_at: string;
}

export default function FirewallDashboardPage() {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
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
      fetchRecentAnalyses();
    }
  }, [user]);

  const fetchRecentAnalyses = async () => {
    try {
      const { data: recentData } = await supabase
        .from('analysis_history')
        .select('id, score, created_at, firewall_id')
        .order('created_at', { ascending: false })
        .limit(5);

      const formattedRecent: RecentAnalysis[] = [];
      if (recentData && recentData.length > 0) {
        const firewallIds = [...new Set(recentData.map(a => a.firewall_id))];
        
        const { data: firewallsData } = await supabase
          .from('firewalls')
          .select('id, name, client_id')
          .in('id', firewallIds);

        const clientIds = [...new Set((firewallsData || []).map(f => f.client_id))];
        
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds);

        const firewallMap = new Map((firewallsData || []).map(f => [f.id, f]));
        const clientMap = new Map((clientsData || []).map(c => [c.id, c]));

        for (const item of recentData) {
          const firewall = firewallMap.get(item.firewall_id);
          const client = firewall ? clientMap.get(firewall.client_id) : null;
          formattedRecent.push({
            id: item.id,
            firewall_name: firewall?.name || 'N/A',
            client_name: client?.name || 'N/A',
            score: item.score,
            created_at: item.created_at,
          });
        }
      }

      setRecentAnalyses(formattedRecent);
    } catch (error) {
      console.error('Error fetching recent analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do ambiente FortiGate</p>
          </div>
          {hasPermission('firewall', 'edit') && (
            <Button onClick={() => navigate('/scope-firewall/firewalls')}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Firewall
            </Button>
          )}
        </div>

        {/* Recent Analyses */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Análises Recentes
            </CardTitle>
            <CardDescription>Últimas verificações de compliance realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : recentAnalyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma análise realizada ainda</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/scope-firewall/firewalls')}
                >
                  Adicionar Firewall
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {recentAnalyses.map((analysis, index) => (
                  <div
                    key={analysis.id}
                    className={cn(
                      "flex items-center gap-4 p-3 hover:bg-secondary/50 transition-colors",
                      index !== recentAnalyses.length - 1 && "border-b border-border/50"
                    )}
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Server className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{analysis.firewall_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{analysis.client_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis.score >= 80 ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : analysis.score >= 60 ? (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                      <span className={`font-bold ${getScoreColor(analysis.score)}`}>
                        {analysis.score}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
