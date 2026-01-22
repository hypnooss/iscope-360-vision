import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Server, Shield, Network, Cloud, Loader2, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface GeneralStats {
  totalFirewalls: number;
  totalClients: number;
}

export default function GeneralDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { userModules, setActiveModule } = useModules();
  const navigate = useNavigate();
  const [stats, setStats] = useState<GeneralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [firewallsRes, clientsRes] = await Promise.all([
        supabase.from('firewalls').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalFirewalls: firewallsRes.count || 0,
        totalClients: clientsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToModule = (moduleCode: string, path: string) => {
    setActiveModule(moduleCode as any);
    navigate(path);
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard Geral</h1>
          <p className="text-muted-foreground">Visão agregada dos recursos monitorados</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              {/* Firewalls Monitored */}
              <Card className="glass-card border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardDescription>Firewall</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Shield className="w-6 h-6 text-orange-500" />
                    </div>
                    {stats?.totalFirewalls || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Firewalls monitorados
                  </p>
                  {userModules.some(m => m.code === 'scope_firewall') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-1 text-orange-500 hover:text-orange-600"
                      onClick={() => handleGoToModule('scope_firewall', '/scope-firewall/dashboard')}
                    >
                      Acessar módulo <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Networks (Placeholder) */}
              <Card className="glass-card border-l-4 border-l-blue-500 opacity-60">
                <CardHeader className="pb-2">
                  <CardDescription>Network</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Network className="w-6 h-6 text-blue-500" />
                    </div>
                    —
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Em breve disponível
                  </p>
                </CardContent>
              </Card>

              {/* Cloud (Placeholder) */}
              <Card className="glass-card border-l-4 border-l-purple-500 opacity-60">
                <CardHeader className="pb-2">
                  <CardDescription>Cloud</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Cloud className="w-6 h-6 text-purple-500" />
                    </div>
                    —
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Em breve disponível
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Clients Overview */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Resumo por Cliente
            </CardTitle>
            <CardDescription>
              {stats?.totalClients || 0} cliente(s) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">
                  Acesse um módulo específico para ver detalhes dos recursos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
