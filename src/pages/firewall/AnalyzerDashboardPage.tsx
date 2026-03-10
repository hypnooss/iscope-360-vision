import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useFirewallSelector } from '@/hooks/useFirewallSelector';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useLatestAnalyzerSnapshot, useAnalyzerProgress } from '@/hooks/useAnalyzerData';
import { Progress } from '@/components/ui/progress';
import { getCountryCode } from '@/lib/countryUtils';
import { AttackMap } from '@/components/firewall/AttackMap';
import { AttackMapFullscreen } from '@/components/firewall/AttackMapFullscreen';
import { AnalyzerStatsCards } from '@/components/firewall/AnalyzerStatsCards';
import { AnalyzerCategoryGrid } from '@/components/firewall/AnalyzerCategoryGrid';
import { AnalyzerCategorySheet } from '@/components/firewall/AnalyzerCategorySheet';
import { cn } from '@/lib/utils';
import {
  Shield, AlertTriangle, AlertOctagon, Info, Play,
  Globe, Wifi, Eye, Server, Lock, KeyRound, ExternalLink,
  Filter, AppWindow, Building2, Zap, Clock, Maximize2, Settings, Calendar, Loader2,
  Activity, Radio, Bug,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import 'flag-icons/css/flag-icons.min.css';
import type { TopBlockedIP, TopCountry, TopCategory, TopUserIP, InterfaceBandwidth, BotnetDomain, AnalyzerEventCategory } from '@/types/analyzerInsights';

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
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);
  const [showAttackMap, setShowAttackMap] = useState(false);

  // Category sheet state
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AnalyzerEventCategory | null>(null);

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<string>('daily');
  const [scheduleHour, setScheduleHour] = useState<number>(15);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState<number>(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState<number>(1);
  const [scheduleActive, setScheduleActive] = useState<boolean>(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Workspace selector for super roles
  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

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

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);

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

  const { selectedFirewallId: selectedFirewall, setSelectedFirewallId: setSelectedFirewall } = useFirewallSelector(firewalls);

  const { data: snapshot, isLoading, refetch } = useLatestAnalyzerSnapshot(selectedFirewall || undefined);

  const { data: progress, refetch: refetchProgress, isFetching: isRefetchingProgress } = useAnalyzerProgress(selectedFirewall || undefined);
  const isRunning = progress?.status === 'pending' || progress?.status === 'processing';

  // Auto-refresh when analysis finishes
  const prevProgressStatus = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = progress?.status ?? null;
    if (
      (currentStatus === 'completed' || currentStatus === 'failed') &&
      prevProgressStatus.current &&
      prevProgressStatus.current !== 'completed' &&
      prevProgressStatus.current !== 'failed'
    ) {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['analyzer-latest', selectedFirewall] });
    }
    prevProgressStatus.current = currentStatus;
  }, [progress?.status, selectedFirewall]);

  // Fetch firewall URL for geolocation
  const { data: firewallUrl } = useQuery({
    queryKey: ['firewall-url', selectedFirewall],
    queryFn: async () => {
      const { data } = await supabase.from('firewalls').select('fortigate_url, name, geo_latitude, geo_longitude').eq('id', selectedFirewall).single();
      return data as any;
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 60 * 30,
  });

  const firewallHostname = (() => {
    if (!firewallUrl?.fortigate_url) return null;
    try { return new URL(firewallUrl.fortigate_url).hostname; } catch { return null; }
  })();

  const isPrivateIP = (ip: string) =>
    /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);

  const looksLikeIP = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

  // Query to fetch WAN public IP from firewall interfaces
  const { data: firewallWanIP } = useQuery({
    queryKey: ['firewall-wan-ip', selectedFirewall],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('id')
        .eq('target_id', selectedFirewall)
        .eq('task_type', 'fortigate_compliance')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);
      if (!tasks?.length) return null;

      const { data: stepResult } = await supabase
        .from('task_step_results')
        .select('data')
        .eq('task_id', tasks[0].id)
        .eq('step_id', 'system_interface')
        .limit(1)
        .single();

      if (!stepResult?.data) return null;
      const results = (stepResult.data as any)?.results;
      if (!Array.isArray(results)) return null;

      for (const iface of results) {
        if (iface.role === 'wan' && iface.ip && iface.status === 'up') {
          const ipOnly = String(iface.ip).split(' ')[0];
          if (ipOnly && !isPrivateIP(ipOnly) && ipOnly !== '0.0.0.0') {
            console.log('[firewall-wan-ip] found:', ipOnly);
            return ipOnly;
          }
        }
      }
      return null;
    },
    enabled: !!selectedFirewall,
    staleTime: 1000 * 60 * 30,
  });

  const { data: firewallGeo } = useQuery({
    queryKey: [
      'firewall-geo-v2',
      selectedFirewall,
      firewallHostname,
      firewallWanIP,
      snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip,
      snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip,
    ],
    queryFn: async () => {
      // Priority 0: stored coordinates from firewall record
      if (firewallUrl?.geo_latitude && firewallUrl?.geo_longitude) {
        console.log('[firewall-geo] using stored coords:', firewallUrl.geo_latitude, firewallUrl.geo_longitude);
        return { lat: firewallUrl.geo_latitude as number, lng: firewallUrl.geo_longitude as number };
      }

      const tryGeolocate = async (target: string) => {
        try {
          const res = await fetch(`https://ipwho.is/${target}`);
          if (!res.ok) return null;
          const json = await res.json();
          if (!json.success || !json.latitude || !json.longitude) return null;
          return { lat: json.latitude as number, lng: json.longitude as number };
        } catch { return null; }
      };

      // 1. Try hostname directly (works if it's a public IP)
      if (firewallHostname && !isPrivateIP(firewallHostname)) {
        if (looksLikeIP(firewallHostname)) {
          const result = await tryGeolocate(firewallHostname);
          if (result) { console.log('[firewall-geo] result:', result); return result; }
        } else {
          try {
            const dnsRes = await fetch(`https://dns.google/resolve?name=${firewallHostname}&type=A`);
            const dnsJson = await dnsRes.json();
            const resolvedIP = dnsJson?.Answer?.find((a: any) => a.type === 1)?.data;
            if (resolvedIP) {
              const result = await tryGeolocate(resolvedIP);
              if (result) { console.log('[firewall-geo] dns result:', result); return result; }
            }
          } catch { /* DNS resolution failed, try fallbacks */ }
        }
      }

      // 2. Fallback: WAN interface public IP from firewall config
      if (firewallWanIP) {
        const result = await tryGeolocate(firewallWanIP);
        if (result) { console.log('[firewall-geo] wan-ip result:', result); return result; }
      }

      // 3. Fallback: first successful auth IP
      const fb1 = snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip;
      if (fb1 && !isPrivateIP(fb1)) {
        const result = await tryGeolocate(fb1);
        if (result) { console.log('[firewall-geo] fallback1 result:', result); return result; }
      }

      // 4. Fallback: first failed auth IP
      const fb2 = snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip;
      if (fb2 && !isPrivateIP(fb2)) {
        const result = await tryGeolocate(fb2);
        if (result) { console.log('[firewall-geo] fallback2 result:', result); return result; }
      }

      console.log('[firewall-geo] all attempts failed');
      return null;
    },
    enabled: !!selectedFirewall && (!!firewallUrl || !!snapshot),
    staleTime: 1000 * 60 * 30,
  });

  // Schedule query
  const { data: currentSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['analyzer-schedule', selectedFirewall],
    queryFn: async () => {
      if (!selectedFirewall) return null;
      const { data } = await supabase
        .from('analyzer_schedules')
        .select('*')
        .eq('firewall_id', selectedFirewall)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!selectedFirewall && isSuperRole,
  });

  // Sync form when dialog opens
  useEffect(() => {
    if (currentSchedule && scheduleDialogOpen) {
      setScheduleFreq(currentSchedule.frequency ?? 'daily');
      setScheduleHour(currentSchedule.scheduled_hour ?? 15);
      setScheduleDayOfWeek(currentSchedule.scheduled_day_of_week ?? 1);
      setScheduleDayOfMonth(currentSchedule.scheduled_day_of_month ?? 1);
      setScheduleActive(currentSchedule.is_active ?? true);
    }
  }, [currentSchedule, scheduleDialogOpen]);

  function calculateNextRun(freq: string, hour: number, dayOfWeek: number, dayOfMonth: number): Date {
    const now = new Date();
    const next = new Date();
    if (freq === 'hourly') {
      next.setMinutes(0, 0, 0);
      next.setTime(next.getTime() + 60 * 60 * 1000);
    } else {
      next.setMinutes(0, 0, 0);
      next.setHours(hour);
      if (freq === 'daily') {
        if (next <= now) next.setDate(next.getDate() + 1);
      } else if (freq === 'weekly') {
        const currentDay = now.getDay();
        let diff = dayOfWeek - currentDay;
        if (diff < 0 || (diff === 0 && next <= now)) diff += 7;
        next.setDate(now.getDate() + diff);
      } else if (freq === 'monthly') {
        next.setDate(dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(dayOfMonth);
        }
      }
    }
    return next;
  }

  const handleSaveSchedule = async () => {
    if (!selectedFirewall) return;
    setScheduleSaving(true);
    try {
      const nextRunAt = calculateNextRun(scheduleFreq, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth);
      const { error } = await supabase
        .from('analyzer_schedules')
        .upsert({
          firewall_id: selectedFirewall,
          frequency: scheduleFreq as any,
          scheduled_hour: scheduleHour,
          scheduled_day_of_week: scheduleDayOfWeek,
          scheduled_day_of_month: scheduleDayOfMonth,
          is_active: scheduleActive,
          next_run_at: nextRunAt.toISOString(),
        }, { onConflict: 'firewall_id' });
      if (error) throw error;
      sonnerToast.success('Agendamento salvo com sucesso!');
      await refetchSchedule();
      setScheduleDialogOpen(false);
    } catch (e: any) {
      sonnerToast.error('Erro ao salvar agendamento', { description: e.message });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTrigger = async () => {
    if (!selectedFirewall) return;
    setTriggering(true);
    try {
      const res = await supabase.functions.invoke('trigger-firewall-analyzer', { body: { firewall_id: selectedFirewall } });
      const body = res.data;

      if (res.error || (body && !body.success)) {
        const msg = body?.error || res.error?.message || 'Falha ao disparar análise';
        if (body?.code === 'ALREADY_RUNNING' || msg.includes('andamento')) {
          toast({ title: 'Análise já em andamento', description: 'Aguarde a conclusão da análise atual antes de iniciar outra.' });
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

  const m = snapshot?.metrics;


  // FW-specific auth rankings — no cross-fallbacks to avoid mixing FW and VPN data
  const fwAuthIPsFailed = m?.topFwAuthIPsFailed ?? [];
  const fwAuthIPsSuccess = m?.topFwAuthIPsSuccess ?? [];
  const fwAuthCountriesFailed = m?.topFwAuthCountriesFailed ?? [];
  const fwAuthCountriesSuccess = m?.topFwAuthCountriesSuccess ?? [];

  // VPN-specific auth rankings
  const vpnAuthIPsFailed = m?.topVpnAuthIPsFailed ?? [];
  const vpnAuthIPsSuccess = m?.topVpnAuthIPsSuccess ?? [];
  const vpnAuthCountriesFailed = m?.topVpnAuthCountriesFailed ?? [];
  const vpnAuthCountriesSuccess = m?.topVpnAuthCountriesSuccess ?? [];

  // authCountriesSuccess removed — now passing fwAuthCountriesSuccess and vpnAuthCountriesSuccess directly

  useEffect(() => {
    if (!authLoading && !user) { navigate('/auth'); return; }
    if (!authLoading && user && !hasModuleAccess('scope_firewall')) { navigate('/modules'); }
  }, [user, authLoading, navigate, hasModuleAccess]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-10">
        <PageBreadcrumb items={[{ label: 'Firewall' }, { label: 'Analyzer' }]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Firewall Analyzer</h1>
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
            <Button onClick={handleTrigger} disabled={triggering || !selectedFirewall || isRunning}>
              {isRunning
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Em andamento...</>
                : <><Play className="w-4 h-4 mr-2" />{triggering ? 'Iniciando...' : 'Executar Análise'}</>}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Configurar agendamento"
              disabled={!selectedFirewall}
              onClick={() => setScheduleDialogOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress card */}
        {isRunning && progress && (
          <Card className="glass-card border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Análise em andamento...</span>
                <div className="flex items-center gap-2 ml-auto">
                  {progress.elapsed !== null && (
                    <span className="text-xs text-muted-foreground">
                      {progress.status === 'pending' ? 'Aguardando agent...' : 'Processando logs...'}
                      {' · '}
                      {Math.floor(progress.elapsed / 60) > 0
                        ? `${Math.floor(progress.elapsed / 60)}m ${progress.elapsed % 60}s`
                        : `${progress.elapsed}s`}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-primary hover:text-primary/80"
                    onClick={() => refetchProgress()}
                    disabled={isRefetchingProgress}
                  >
                    <Loader2 className={cn('w-3 h-3', isRefetchingProgress && 'animate-spin')} />
                    Atualizar
                  </Button>
                </div>
              </div>
              <Progress value={progress.status === 'pending' ? 15 : 60} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Last analysis info */}
        {snapshot && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última coleta:</span>
            <Badge variant="outline" className="text-xs">
              {new Date(snapshot.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {snapshot.period_start && snapshot.period_end && (
              <>
                <span className="text-sm text-muted-foreground">Período agregado:</span>
                <Badge variant="outline" className="text-xs">
                  {new Date(snapshot.period_start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {new Date(snapshot.period_end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Badge>
              </>
            )}
            {(snapshot as any).snapshotCount && (
              <Badge variant="secondary" className="text-xs">
                {(snapshot as any).snapshotCount} coletas
              </Badge>
            )}
          </div>
        )}

        {/* Stats Cards */}
        {snapshot && !isLoading && (
          <div>
            <AnalyzerStatsCards snapshot={snapshot} />
          </div>
        )}

        {/* Category Grid */}
        {snapshot && !isLoading && (
          <div className="mb-6">
            <AnalyzerCategoryGrid 
              snapshot={snapshot} 
              onCategoryClick={(category) => {
                setSelectedCategory(category);
                setCategorySheetOpen(true);
              }} 
            />
          </div>
        )}

        {/* Attack Map - Always visible */}
        {snapshot && (
          <>
            <Card
              className="glass-card mb-6 cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => setShowAttackMap(true)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Mapa de Ataques
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Tela cheia
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="max-h-[200px] overflow-hidden rounded-md opacity-90 group-hover:opacity-100 transition-opacity">
                <AttackMap
                    authFailedCountries={fwAuthCountriesFailed}
                    authFailedVpnCountries={vpnAuthCountriesFailed}
                    authSuccessCountries={fwAuthCountriesSuccess}
                    authSuccessVpnCountries={vpnAuthCountriesSuccess}
                    outboundCountries={m?.topOutboundCountries ?? []}
                    outboundBlockedCountries={m?.topOutboundBlockedCountries ?? []}
                    firewallLocation={firewallGeo ? { ...firewallGeo, label: firewallUrl?.name || 'Firewall' } : undefined}
                  />
                </div>
              </CardContent>
            </Card>

            {showAttackMap && (
              <AttackMapFullscreen
                authFailedCountries={fwAuthCountriesFailed}
                authFailedVpnCountries={vpnAuthCountriesFailed}
                authSuccessCountries={fwAuthCountriesSuccess}
                authSuccessVpnCountries={vpnAuthCountriesSuccess}
                outboundCountries={m?.topOutboundCountries ?? []}
                outboundBlockedCountries={m?.topOutboundBlockedCountries ?? []}
                firewallLocation={firewallGeo ? { ...firewallGeo, label: firewallUrl?.name || 'Firewall' } : undefined}
                firewallName={firewallUrl?.name}
                lastAnalysis={snapshot.created_at}
                totalFwAuthFailed={m?.firewallAuthFailures ?? 0}
                totalVpnAuthFailed={m?.vpnFailures ?? 0}
                totalFwAuthSuccess={m?.firewallAuthSuccesses ?? 0}
                totalVpnAuthSuccess={m?.vpnSuccesses ?? 0}
                totalOutbound={m?.outboundConnections ?? 0}
                totalOutboundBlocked={m?.outboundBlocked ?? 0}
                topBlockedIPs={m?.topBlockedIPs ?? []}
                topOutboundCountries={m?.topOutboundCountries ?? []}
                topOutboundBlockedCountries={m?.topOutboundBlockedCountries ?? []}
                onClose={() => setShowAttackMap(false)}
              />
            )}
          </>
        )}

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top IPs - Tráfego - Saída Permitida / Bloqueada */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ExternalLink className="w-4 h-4 text-primary" />
                Top IPs - Tráfego
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="blocked">
                  <TabsList className="mb-3 flex-wrap h-auto gap-1">
                    <TabsTrigger value="blocked">Saída Bloqueada</TabsTrigger>
                    <TabsTrigger value="allowed">Saída Permitida</TabsTrigger>
                    <TabsTrigger value="inbound_blocked">Entrada Bloqueada</TabsTrigger>
                    <TabsTrigger value="inbound_allowed">Entrada Permitida</TabsTrigger>
                  </TabsList>
                  <TabsContent value="blocked">
                    <IPListWidget ips={m?.topOutboundBlockedIPs ?? []} />
                  </TabsContent>
                  <TabsContent value="allowed">
                    <IPListWidget ips={m?.topOutboundIPs ?? []} />
                  </TabsContent>
                  <TabsContent value="inbound_blocked">
                    <IPListWidget ips={m?.topInboundBlockedIPs ?? []} />
                  </TabsContent>
                  <TabsContent value="inbound_allowed">
                    <IPListWidget ips={m?.topInboundAllowedIPs ?? []} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top Countries - Tráfego */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                Top Países - Tráfego
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="outbound_blocked">
                  <TabsList className="mb-3 flex-wrap h-auto gap-1">
                    <TabsTrigger value="outbound_blocked">Saída Bloqueada</TabsTrigger>
                    <TabsTrigger value="outbound_allowed">Saída Permitida</TabsTrigger>
                    <TabsTrigger value="inbound_blocked">Entrada Bloqueada</TabsTrigger>
                    <TabsTrigger value="inbound_allowed">Entrada Permitida</TabsTrigger>
                  </TabsList>
                  <TabsContent value="outbound_blocked">
                    <CountryListWidget countries={m?.topOutboundBlockedCountries ?? []} />
                  </TabsContent>
                  <TabsContent value="outbound_allowed">
                    <CountryListWidget countries={m?.topOutboundCountries ?? []} />
                  </TabsContent>
                  <TabsContent value="inbound_blocked">
                    <CountryListWidget countries={m?.topInboundBlockedCountries ?? []} />
                  </TabsContent>
                  <TabsContent value="inbound_allowed">
                    <CountryListWidget countries={m?.topInboundAllowedCountries ?? []} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top IPs - Auth Firewall */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-warning" />
                Top IPs - Auth Firewall
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed"><IPListWidget ips={fwAuthIPsFailed} /></TabsContent>
                  <TabsContent value="success"><IPListWidget ips={fwAuthIPsSuccess} /></TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top Países - Auth Firewall */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="w-4 h-4 text-warning" />
                Top Países - Auth Firewall
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed"><CountryListWidget countries={fwAuthCountriesFailed} /></TabsContent>
                  <TabsContent value="success"><CountryListWidget countries={fwAuthCountriesSuccess} /></TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top IPs - Auth VPN */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="w-4 h-4 text-primary" />
                Top IPs - Auth VPN
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed"><IPListWidget ips={vpnAuthIPsFailed} /></TabsContent>
                  <TabsContent value="success"><IPListWidget ips={vpnAuthIPsSuccess} /></TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          {/* Top Países - Auth VPN */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="w-4 h-4 text-warning" />
                Top Países - Auth VPN
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : (
                <Tabs defaultValue="failed">
                  <TabsList className="mb-3">
                    <TabsTrigger value="failed">Falhas</TabsTrigger>
                    <TabsTrigger value="success">Sucessos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="failed"><CountryListWidget countries={vpnAuthCountriesFailed} /></TabsContent>
                  <TabsContent value="success"><CountryListWidget countries={vpnAuthCountriesSuccess} /></TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>


          {/* Top Web Filter Categories */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-primary" />
                Web Filter - Top Categorias Bloqueadas
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
                Application Control - Top Aplicações Bloqueadas
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
                IPS/IDS - Anomalias de Rede
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

          {/* Botnet Domains */}
          {(m?.botnetDomains?.length ?? 0) > 0 && (
            <Card className="glass-card border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="w-4 h-4 text-destructive" />
                  Domínios de Botnet Detectados
                  <Badge variant="destructive" className="ml-auto text-xs">{m?.botnetDetections ?? 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RankingListWidget items={(m?.botnetDomains ?? []).map(d => ({ domain: d.domain, count: d.count }))} labelKey="domain" />
              </CardContent>
            </Card>
          )}

          {/* Interface Bandwidth */}
          {(m?.interfaceBandwidth?.length ?? 0) > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radio className="w-4 h-4 text-primary" />
                  Bandwidth por Interface
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {(m?.interfaceBandwidth ?? []).slice(0, 10).map((iface, i) => {
                    const totalBytes = iface.tx_bytes + iface.rx_bytes;
                    const formatBytes = (b: number) => {
                      if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
                      if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
                      if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
                      return `${b} B`;
                    };
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-secondary/50 transition-colors">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-secondary text-[10px] font-bold text-muted-foreground shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">{iface.name}</span>
                        </div>
                        <div className="flex gap-3 text-xs shrink-0">
                          <span className="text-primary">↑ {formatBytes(iface.tx_bytes)}</span>
                          <span className="text-muted-foreground">↓ {formatBytes(iface.rx_bytes)}</span>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">{formatBytes(totalBytes)}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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
                          insight.severity === 'critical' && 'text-destructive border-destructive/30',
                          insight.severity === 'high' && 'text-warning border-warning/30',
                          insight.severity === 'medium' && 'text-primary border-primary/30',
                          insight.severity === 'low' && 'text-muted-foreground border-muted-foreground/30',
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

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agendamento do Firewall Analyzer
            </DialogTitle>
            <DialogDescription>
              Configure a frequência de execução automática do Analyzer para este firewall.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-blue-500/30 bg-blue-500/5">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm text-muted-foreground">
              A análise do Analyzer monitora eventos e métricas em tempo real. Recomendamos agendar a execução 1 vez por hora.
            </AlertDescription>
          </Alert>

          <div className="space-y-5 py-2">
            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="sched-active" className="text-sm font-medium">Agendamento ativo</Label>
              <Switch id="sched-active" checked={scheduleActive} onCheckedChange={setScheduleActive} />
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Frequência</Label>
              <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Por Hora</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hour (hidden for hourly) */}
            {scheduleFreq !== 'hourly' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Hora de execução (UTC-3)</Label>
                <Select value={String(scheduleHour)} onValueChange={v => setScheduleHour(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day of week (weekly only) */}
            {scheduleFreq === 'weekly' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dia da semana</Label>
                <Select value={String(scheduleDayOfWeek)} onValueChange={v => setScheduleDayOfWeek(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day of month (monthly only) */}
            {scheduleFreq === 'monthly' && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dia do mês</Label>
                <Select value={String(scheduleDayOfMonth)} onValueChange={v => setScheduleDayOfMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Next run preview */}
            <div className="rounded-md bg-muted/20 border border-border/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Próxima execução estimada: </span>
              {calculateNextRun(scheduleFreq, scheduleHour, scheduleDayOfWeek, scheduleDayOfMonth).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} disabled={scheduleSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSchedule} disabled={scheduleSaving}>
              {scheduleSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Detail Sheet */}
      <AnalyzerCategorySheet 
        open={categorySheetOpen}
        onOpenChange={setCategorySheetOpen}
        category={selectedCategory}
        snapshot={snapshot!}
      />
    </AppLayout>
  );
}
