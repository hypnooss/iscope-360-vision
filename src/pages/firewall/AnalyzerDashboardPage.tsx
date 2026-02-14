import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot } from '@/hooks/useAnalyzerData';
import { getCountryCode } from '@/lib/countryUtils';
import { AttackMap } from '@/components/firewall/AttackMap';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, AlertOctagon, Info, Play,
  Globe, Wifi, Eye, Server, Lock, KeyRound, ExternalLink,
  Filter, AppWindow, Building2, Zap, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import 'flag-icons/css/flag-icons.min.css';
import type { TopBlockedIP, TopCountry, TopCategory, TopUserIP } from '@/types/analyzerInsights';

interface FirewallOption { id: string; name: string; client_id: string; }

// Reusable country name + flag renderer
function CountryName({ country }: { country: string }) {
  const code = getCountryCode(country);
  return (
    <span className="flex items-center gap-1.5">
      {code && <span className={`fi fi-${code} text-sm`} />}
      <span>{country}</span>
    </span>
  );
}

// Reusable IP list widget
function IPListWidget({ ips }: { ips: TopBlockedIP[] }) {
  if (!ips?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>;
  const maxCount = Math.max(...ips.map(ip => ip.count), 1);
  return (
    <div className="space-y-1">
      {ips.slice(0, 10).map((ip, i) => (
        <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-foreground">{ip.ip}</span>
              {ip.country && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <CountryName country={ip.country} />
                </span>
              )}
            </div>
            {ip.targetPorts?.length > 0 && (
              <span className="text-[10px] text-muted-foreground hidden md:inline shrink-0">
                {ip.targetPorts.slice(0, 3).join(', ')}{ip.targetPorts.length > 3 ? '…' : ''}
              </span>
            )}
            <Badge variant="secondary" className="font-mono text-xs shrink-0">{ip.count}</Badge>
          </div>
          <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all"
              style={{ width: `${(ip.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Reusable country list widget
function CountryListWidget({ countries }: { countries: TopCountry[] }) {
  if (!countries?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>;
  const maxCount = Math.max(...countries.map(c => c.count), 1);
  return (
    <div className="space-y-1">
      {countries.slice(0, 10).map((c, i) => (
        <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 text-sm text-foreground">
              <CountryName country={c.country} />
            </div>
            <Badge variant="secondary" className="font-mono text-xs shrink-0">{c.count}</Badge>
          </div>
          <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all"
              style={{ width: `${(c.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Reusable category/app ranking widget
function RankingListWidget({ items, labelKey }: { items: { [key: string]: any; count: number }[]; labelKey: string }) {
  if (!items?.length) return <p className="text-muted-foreground text-sm py-4 text-center">Nenhum dado disponível</p>;
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-1">
      {items.slice(0, 10).map((item, i) => (
        <div key={i} className="py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground truncate block">{item[labelKey]}</span>
              {item.ip && <span className="text-[10px] text-muted-foreground font-mono">{item.ip}</span>}
              {item.category && labelKey !== 'category' && <span className="text-[10px] text-muted-foreground ml-1">({item.category})</span>}
            </div>
            <Badge variant="secondary" className="font-mono text-xs shrink-0">{item.count}</Badge>
          </div>
          <div className="mt-1.5 ml-8 h-1 bg-secondary/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/50 rounded-full transition-all"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyzerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { effectiveRole } = useEffectiveAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedFirewall, setSelectedFirewall] = useState<string>('');
  const [triggering, setTriggering] = useState(false);

  // Workspace selector for super roles
  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  // Auto-select first workspace
  useEffect(() => {
    if (isSuperRole && allWorkspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(allWorkspaces[0].id);
    }
  }, [isSuperRole, allWorkspaces, selectedWorkspaceId]);

  // Fetch firewalls filtered by workspace
  const { data: firewalls = [] } = useQuery({
    queryKey: ['analyzer-firewalls', selectedWorkspaceId, isSuperRole],
    queryFn: async () => {
      let query = supabase.from('firewalls').select('id, name, client_id').order('name');
      if (isSuperRole && selectedWorkspaceId) {
        query = query.eq('client_id', selectedWorkspaceId);
      }
      const { data } = await query;
      return (data ?? []) as FirewallOption[];
    },
    enabled: isSuperRole ? !!selectedWorkspaceId : true,
  });

  // Auto-select first firewall when list changes
  useEffect(() => {
    if (firewalls.length > 0 && !firewalls.find(f => f.id === selectedFirewall)) {
      setSelectedFirewall(firewalls[0].id);
    } else if (firewalls.length === 0) {
      setSelectedFirewall('');
    }
  }, [firewalls]);

  const { data: snapshot, isLoading, refetch } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);

  // Fetch firewall URL for geolocation
  const { data: firewallUrl } = useQuery({
    queryKey: ['firewall-url', selectedFirewall],
    queryFn: async () => {
      const { data } = await supabase.from('firewalls').select('fortigate_url, name').eq('id', selectedFirewall).single();
      return data;
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 60 * 30,
  });

  const firewallHostname = (() => {
    if (!firewallUrl?.fortigate_url) return null;
    try { return new URL(firewallUrl.fortigate_url).hostname; } catch { return null; }
  })();

  const { data: firewallGeo } = useQuery({
    queryKey: ['firewall-geo', firewallHostname],
    queryFn: async () => {
      const res = await fetch(`https://ipwho.is/${firewallHostname}`);
      const json = await res.json();
      if (!json.success) return null;
      return { lat: json.latitude as number, lng: json.longitude as number };
    },
    enabled: !!firewallHostname,
    staleTime: 1000 * 60 * 30,
  });

  const handleTrigger = async () => {
    if (!selectedFirewall) return;
    setTriggering(true);
    try {
      const res = await supabase.functions.invoke('trigger-firewall-analyzer', { body: { firewall_id: selectedFirewall } });
      const body = res.data;
      if (res.error || (body && !body.success)) {
        const msg = body?.error || res.error?.message || 'Falha ao disparar análise';
        if (msg.includes('já em andamento')) {
          toast({ title: 'Análise em andamento', description: 'Aguarde a conclusão da análise atual antes de iniciar outra.' });
        } else {
          toast({ title: 'Erro', description: msg, variant: 'destructive' });
        }
        return;
      }
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

  const m = snapshot?.metrics;

  // Use split metrics when available, fallback to combined
  const authIPsFailed = m?.topAuthIPsFailed?.length ? m.topAuthIPsFailed : m?.topAuthIPs ?? [];
  const authIPsSuccess = m?.topAuthIPsSuccess ?? [];
  const authCountriesFailed = m?.topAuthCountriesFailed?.length ? m.topAuthCountriesFailed : m?.topAuthCountries ?? [];
  const authCountriesSuccess = m?.topAuthCountriesSuccess ?? [];

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) { navigate('/modules'); }
  }, [user, authLoading, navigate, hasModuleAccess]);

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
            {isSuperRole && !isPreviewMode && (
              <Select value={selectedWorkspaceId ?? ''} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedFirewall(''); }}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces?.map(ws => <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedFirewall} onValueChange={setSelectedFirewall}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Selecionar firewall" /></SelectTrigger>
              <SelectContent>
                {firewalls.map(fw => <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleTrigger} disabled={triggering || !selectedFirewall}>
              <Play className="w-4 h-4 mr-2" />
              {triggering ? 'Iniciando...' : 'Executar Análise'}
            </Button>
          </div>
        </div>

        {/* Last analysis info */}
        {snapshot && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última análise:</span>
            <Badge variant="outline" className="text-xs">
              {new Date(snapshot.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {snapshot.period_start && snapshot.period_end && (
              <>
                <span className="text-sm text-muted-foreground">Período:</span>
                <Badge variant="outline" className="text-xs">
                  {new Date(snapshot.period_start).toLocaleDateString('pt-BR')} — {new Date(snapshot.period_end).toLocaleDateString('pt-BR')}
                </Badge>
              </>
            )}
            <Badge variant={snapshot.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
              {snapshot.status === 'completed' ? 'Concluída' : snapshot.status === 'processing' ? 'Em andamento' : snapshot.status}
            </Badge>
          </div>
        )}

        {/* Severity Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {isLoading
            ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : severityCards.map(c => (
                <Card key={c.label} className={cn('glass-card border', c.color)}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <c.icon className="w-8 h-8" />
                    <div>
                      <div className="text-2xl font-bold">{c.value}</div>
                      <div className="text-xs opacity-80">{c.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Resumo de Eventos - Full width, above map */}
        {snapshot && (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="w-4 h-4 text-primary" />
                Resumo de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Tráfego Negado', value: m?.totalDenied ?? 0, icon: Shield },
                  { label: 'Login Firewall', value: m?.firewallAuthFailures ?? 0, icon: Lock },
                  { label: 'Falhas VPN', value: m?.vpnFailures ?? 0, icon: Wifi },
                  { label: 'Eventos IPS', value: m?.ipsEvents ?? 0, icon: AlertTriangle },
                  {
                    label: 'Alterações Config',
                    value: m?.configChanges ?? 0,
                    icon: Server,
                    onClick: () => navigate('/scope-firewall/analyzer/config-changes'),
                  },
                  { label: 'Web Filter', value: m?.webFilterBlocked ?? 0, icon: Filter },
                  { label: 'App Control', value: m?.appControlBlocked ?? 0, icon: AppWindow },
                  { label: 'Anomalias', value: m?.anomalyEvents ?? 0, icon: Zap },
                ].map(s => (
                  <div
                    key={s.label}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg bg-secondary/30',
                      'onClick' in s && s.onClick && 'cursor-pointer hover:bg-secondary/50 transition-colors'
                    )}
                    onClick={'onClick' in s ? s.onClick : undefined}
                  >
                    <s.icon className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-lg font-bold text-foreground">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                    {'onClick' in s && s.onClick && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attack Map - Always visible */}
        {snapshot && (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Mapa de Ataques
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <AttackMap
                deniedCountries={m?.topCountries ?? []}
                authFailedCountries={authCountriesFailed}
                authSuccessCountries={authCountriesSuccess}
                firewallLocation={firewallGeo ? { ...firewallGeo, label: firewallUrl?.name || 'Firewall' } : undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Blocked IPs - Denied Traffic */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Top IPs Bloqueados (Tráfego Negado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                : <IPListWidget ips={m?.topBlockedIPs ?? []} />}
            </CardContent>
          </Card>

          {/* Top Countries - Denied Traffic */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Top Países (Tráfego Negado)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                : <CountryListWidget countries={m?.topCountries ?? []} />}
            </CardContent>
          </Card>

          {/* Top Auth IPs - with tabs */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-primary" />
                Top IPs - Autenticação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed">
                    <IPListWidget ips={authIPsFailed} />
                  </TabsContent>
                  <TabsContent value="success">
                    <IPListWidget ips={authIPsSuccess} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top Auth Countries - with tabs */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-primary" />
                Top Países - Autenticação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed">
                    <CountryListWidget countries={authCountriesFailed} />
                  </TabsContent>
                  <TabsContent value="success">
                    <CountryListWidget countries={authCountriesSuccess} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>


          {/* Top Web Filter Categories */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-primary" />
                Top Categorias Web Bloqueadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="categories">
                  <TabsList className="mb-3">
                    <TabsTrigger value="categories">Categorias</TabsTrigger>
                    <TabsTrigger value="users">Usuários/IPs</TabsTrigger>
                  </TabsList>
                  <TabsContent value="categories">
                    <RankingListWidget items={m?.topWebFilterCategories ?? []} labelKey="category" />
                  </TabsContent>
                  <TabsContent value="users">
                    <RankingListWidget items={m?.topWebFilterUsers ?? []} labelKey="user" />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top App Control */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AppWindow className="w-4 h-4 text-primary" />
                Top Aplicações Bloqueadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="apps">
                  <TabsList className="mb-3">
                    <TabsTrigger value="apps">Aplicações</TabsTrigger>
                    <TabsTrigger value="users">Usuários/IPs</TabsTrigger>
                  </TabsList>
                  <TabsContent value="apps">
                    <RankingListWidget items={(m?.topAppControlApps ?? []).map(a => ({ ...a, category: a.category }))} labelKey="app" />
                  </TabsContent>
                  <TabsContent value="users">
                    <RankingListWidget items={m?.topAppControlUsers ?? []} labelKey="user" />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Anomalies */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-primary" />
                Anomalias de Rede
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="types">
                  <TabsList className="mb-3">
                    <TabsTrigger value="types">Tipos</TabsTrigger>
                    <TabsTrigger value="sources">IPs Origem</TabsTrigger>
                  </TabsList>
                  <TabsContent value="types">
                    <RankingListWidget items={m?.topAnomalyTypes ?? []} labelKey="category" />
                  </TabsContent>
                  <TabsContent value="sources">
                    <IPListWidget ips={m?.topAnomalySources ?? []} />
                  </TabsContent>
                </Tabs>
              )}
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
