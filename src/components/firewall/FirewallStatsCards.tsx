import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Server, AlertTriangle, TrendingUp, Shield } from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  totalFirewalls: number;
  averageScore: number;
  criticalIssues: number;
}

interface FirewallStatsCardsProps {
  onStatsLoaded?: (stats: DashboardStats) => void;
}

export function FirewallStatsCards({ onStatsLoaded }: FirewallStatsCardsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [clientsRes, firewallsRes, historyRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('firewalls').select('id', { count: 'exact', head: true }),
        supabase.from('analysis_history').select('id, score', { count: 'exact' }).limit(100),
      ]);

      const totalClients = clientsRes.count || 0;
      const totalFirewalls = firewallsRes.count || 0;
      const analyses = historyRes.data || [];
      
      const averageScore = analyses.length > 0
        ? Math.round(analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length)
        : 0;

      const newStats = {
        totalClients,
        totalFirewalls,
        averageScore,
        criticalIssues: analyses.filter(a => a.score < 50).length,
      };

      setStats(newStats);
      onStatsLoaded?.(newStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array(4).fill(0).map((_, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Server className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Firewalls</p>
              <p className="text-2xl font-bold text-foreground">{stats?.totalFirewalls || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success/10">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Score Médio</p>
              <p className={`text-2xl font-bold ${getScoreColor(stats?.averageScore || 0)}`}>
                {stats?.averageScore || 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Críticos</p>
              <p className="text-2xl font-bold text-foreground">{stats?.criticalIssues || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-secondary">
              <Shield className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold text-foreground">{stats?.totalClients || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
