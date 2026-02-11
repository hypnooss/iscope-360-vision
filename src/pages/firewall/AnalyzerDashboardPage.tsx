import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot } from '@/hooks/useAnalyzerData';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, AlertOctagon, Info, Play,
  Globe, Wifi, Eye, Server,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FirewallOption {
  id: string;
  name: string;
}

export default function AnalyzerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [firewalls, setFirewalls] = useState<FirewallOption[]>([]);
  const [selectedFirewall, setSelectedFirewall] = useState<string>('');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) { navigate('/modules'); }
  }, [user, authLoading, navigate, hasModuleAccess]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('firewalls').select('id, name').order('name');
      if (data && data.length > 0) {
        setFirewalls(data);
        setSelectedFirewall(data[0].id);
      }
    })();
  }, []);

  const { data: snapshot, isLoading, refetch } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);

  const handleTrigger = async () => {
    if (!selectedFirewall) return;
    setTriggering(true);
    try {
      const res = await supabase.functions.invoke('trigger-firewall-analyzer', {
        body: { firewall_id: selectedFirewall },
      });
      if (res.error) throw res.error;
      toast({ title: 'Análise iniciada', description: 'O agent irá coletar os logs em breve.' });
      setTimeout(() => refetch(), 5000);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao disparar análise', variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  };

  const severityCards = [
    { label: 'Critical', value: snapshot?.summary?.critical ?? 0, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', icon: AlertOctagon },
    { label: 'High', value: snapshot?.summary?.high ?? 0, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', icon: AlertTriangle },
    { label: 'Medium', value: snapshot?.summary?.medium ?? 0, color: 'text-warning bg-warning/10 border-warning/30', icon: Shield },
    { label: 'Low', value: snapshot?.summary?.low ?? 0, color: 'text-primary bg-primary/10 border-primary/30', icon: Info },
  ];

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[{ label: 'Firewall', href: '/scope-firewall/firewalls' }, { label: 'Analyzer' }]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analyzer</h1>
            <p className="text-muted-foreground">Inteligência de segurança baseada em logs</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar firewall" />
              </SelectTrigger>
              <SelectContent>
                {firewalls.map(fw => (
                  <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleTrigger} disabled={triggering || !selectedFirewall}>
              <Play className="w-4 h-4 mr-2" />
              {triggering ? 'Iniciando...' : 'Executar Análise'}
            </Button>
          </div>
        </div>

        {/* Score */}
        {snapshot && (
          <div className="mb-6 flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Score de Risco</div>
            <div className={cn(
              'text-3xl font-bold',
              (snapshot.score ?? 100) >= 75 ? 'text-success' : (snapshot.score ?? 100) >= 50 ? 'text-warning' : 'text-destructive'
            )}>
              {snapshot.score ?? '—'}
            </div>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {snapshot.period_start
                ? `${new Date(snapshot.period_start).toLocaleDateString('pt-BR')} - ${new Date(snapshot.period_end!).toLocaleDateString('pt-BR')}`
                : new Date(snapshot.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          </div>
        )}

        {/* Severity Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            severityCards.map(c => (
              <Card key={c.label} className={cn('glass-card border', c.color)}>
                <CardContent className="flex items-center gap-4 p-5">
                  <c.icon className="w-8 h-8" />
                  <div>
                    <div className="text-2xl font-bold">{c.value}</div>
                    <div className="text-xs opacity-80">{c.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Blocked IPs */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Top IPs Bloqueados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
              ) : !snapshot?.metrics?.topBlockedIPs?.length ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.metrics.topBlockedIPs.slice(0, 10).map((ip, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <span className="text-muted-foreground w-5">{i + 1}.</span>
                        <span className="text-foreground">{ip.ip}</span>
                        {ip.country && <span className="text-muted-foreground text-xs">({ip.country})</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Portas: {ip.targetPorts.slice(0, 3).join(', ')}{ip.targetPorts.length > 3 ? '...' : ''}
                        </span>
                        <Badge variant="secondary" className="font-mono">{ip.count}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Countries */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Top Países
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
              ) : !snapshot?.metrics?.topCountries?.length ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.metrics.topCountries.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                      <span className="text-sm text-foreground">{c.country}</span>
                      <Badge variant="secondary" className="font-mono">{c.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="w-4 h-4 text-primary" />
                Resumo de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Tráfego Negado', value: snapshot?.metrics?.totalDenied ?? 0, icon: Shield },
                  { label: 'Falhas VPN', value: snapshot?.metrics?.vpnFailures ?? 0, icon: Wifi },
                  { label: 'Eventos IPS', value: snapshot?.metrics?.ipsEvents ?? 0, icon: AlertTriangle },
                  { label: 'Alterações Config', value: snapshot?.metrics?.configChanges ?? 0, icon: Server },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <s.icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-lg font-bold text-foreground">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Insights Preview */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="w-4 h-4 text-primary" />
                Insights Recentes
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/scope-firewall/analyzer/insights')}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              {!snapshot?.insights?.length ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Nenhum insight disponível</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.insights.slice(0, 5).map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs mt-0.5 shrink-0',
                          insight.severity === 'critical' && 'text-rose-400 border-rose-500/30',
                          insight.severity === 'high' && 'text-orange-400 border-orange-500/30',
                          insight.severity === 'medium' && 'text-warning border-warning/30',
                          insight.severity === 'low' && 'text-primary border-primary/30',
                        )}
                      >
                        {insight.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{insight.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
