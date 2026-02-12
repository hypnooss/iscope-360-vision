import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe,
  Server,
  Bug,
  Activity,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radar,
  AlertTriangle,
  Network,
  Building2,
  Clock,
  CheckCircle2,
  Timer,
  Play,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useLatestAttackSurfaceSnapshot,
  useAttackSurfaceScan,
  useAttackSurfaceCancelScan,
  type AttackSurfaceSnapshot,
  type AttackSurfaceService,
  type AttackSurfaceWebService,
} from '@/hooks/useAttackSurfaceData';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function useClientId() {
  const { profile } = useAuth();
  const { effectiveProfile } = useEffectiveAuth();
  const userId = effectiveProfile?.id || profile?.id;

  return useQuery({
    queryKey: ['user-client-id', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', userId)
        .limit(1);
      return data?.[0]?.client_id ?? null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}

/** Progress of the current (or latest) scan for a given client */
function useAttackSurfaceProgress(clientId?: string) {
  return useQuery({
    queryKey: ['attack-surface-progress', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get latest snapshot (any status)
      const { data, error } = await (supabase
        .from('attack_surface_snapshots' as any)
        .select('id, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1) as any);

      if (error) throw error;
      const snapshot = (data as any[])?.[0];
      if (!snapshot) return null;

      if (snapshot.status === 'completed') return { status: 'completed' as const, percent: 100, total: 0, done: 0 };

      // Count tasks
      const [totalRes, doneRes] = await Promise.all([
        supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id),
        supabase.from('attack_surface_tasks').select('id', { count: 'exact', head: true }).eq('snapshot_id', snapshot.id).eq('status', 'completed'),
      ]);

      const total = totalRes.count ?? 0;
      const done = doneRes.count ?? 0;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      return { status: snapshot.status as string, percent, total, done };
    },
    enabled: !!clientId,
    refetchInterval: 10000, // poll every 10s when scan is running
    staleTime: 5000,
  });
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-info/20 text-info border-info/30',
  };
  return (
    <Badge variant="outline" className={colors[severity?.toLowerCase()] || 'bg-muted text-muted-foreground'}>
      {severity || 'N/A'}
    </Badge>
  );
}

function ExposureScoreGauge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="text-3xl font-mono font-bold text-muted-foreground">—</span>
        <span className="text-xs text-muted-foreground mt-1">Sem dados</span>
      </div>
    );
  }

  const color = score >= 70 ? 'text-destructive' : score >= 40 ? 'text-warning' : 'text-primary';
  const label = score >= 70 ? 'Alto Risco' : score >= 40 ? 'Risco Moderado' : 'Baixo Risco';
  const bgRing = score >= 70 ? 'stroke-destructive/20' : score >= 40 ? 'stroke-warning/20' : 'stroke-primary/20';
  const fgRing = score >= 70 ? 'stroke-destructive' : score >= 40 ? 'stroke-warning' : 'stroke-primary';

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className={bgRing} />
          <circle
            cx="50" cy="50" r={radius} fill="none" strokeWidth="8"
            className={fgRing}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-mono font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <span className={`text-xs mt-2 font-medium ${color}`}>{label}</span>
    </div>
  );
}

function PortHeatmap({ snapshot }: { snapshot: AttackSurfaceSnapshot }) {
  const portCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(snapshot.results).forEach((r) => {
      (r.ports || []).forEach((p: number) => {
        counts[p] = (counts[p] || 0) + 1;
      });
      // Extract ports from web_services URLs when masscan data is missing
      (r.web_services || []).forEach((ws: AttackSurfaceWebService) => {
        try {
          const url = new URL(ws.url);
          const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
          counts[port] = (counts[port] || 0) + 1;
        } catch { /* ignore invalid URLs */ }
      });
    });
    return Object.entries(counts)
      .map(([port, count]) => ({ port: Number(port), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [snapshot.results]);

  if (portCounts.length === 0) return null;

  const maxCount = portCounts[0]?.count ?? 1;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Server className="w-4 h-4 text-orange-400" />
          Top Portas Abertas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {portCounts.map(({ port, count }) => {
            const intensity = Math.round((count / maxCount) * 100);
            const bg = intensity >= 75 ? 'bg-destructive/30 border-destructive/50 text-destructive' :
              intensity >= 50 ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' :
                intensity >= 25 ? 'bg-warning/20 border-warning/40 text-warning' :
                  'bg-muted/50 border-border text-muted-foreground';
            return (
              <TooltipProvider key={port}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`px-2.5 py-1.5 rounded-md border text-xs font-mono cursor-default ${bg}`}>
                      {port}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Porta {port} — encontrada em {count} IP(s)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TechStackSection({ snapshot }: { snapshot: AttackSurfaceSnapshot }) {
  const techStack = useMemo(() => {
    const products = new Map<string, { count: number; versions: Set<string> }>();
    Object.values(snapshot.results).forEach((r) => {
      (r.services || []).forEach((svc: AttackSurfaceService) => {
        if (svc.product) {
          const existing = products.get(svc.product) || { count: 0, versions: new Set() };
          existing.count++;
          if (svc.version) existing.versions.add(svc.version);
          products.set(svc.product, existing);
        }
      });
      // Include technologies from httpx web_services
      (r.web_services || []).forEach((ws: AttackSurfaceWebService) => {
        (ws.technologies || []).forEach((tech) => {
          const existing = products.get(tech) || { count: 0, versions: new Set<string>() };
          existing.count++;
          products.set(tech, existing);
        });
        if (ws.server) {
          const existing = products.get(ws.server) || { count: 0, versions: new Set<string>() };
          existing.count++;
          products.set(ws.server, existing);
        }
      });
    });
    return Array.from(products.entries())
      .map(([name, data]) => ({ name, count: data.count, versions: Array.from(data.versions) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [snapshot.results]);

  if (techStack.length === 0) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-info" />
          Stack Tecnológico Detectado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {techStack.map((tech) => (
            <TooltipProvider key={tech.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1.5 cursor-default">
                    {tech.name}
                    <span className="text-muted-foreground">×{tech.count}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {tech.versions.length > 0
                    ? `Versões: ${tech.versions.join(', ')}`
                    : 'Versão não identificada'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IPDetailRow({ ip, snapshot }: { ip: string; snapshot: AttackSurfaceSnapshot }) {
  const [open, setOpen] = useState(false);
  const sourceIP = snapshot.source_ips.find((s) => s.ip === ip);
  const result = snapshot.results[ip];
  const ipCVEs = snapshot.cve_matches.filter((c) =>
    result?.vulns?.includes(c.cve_id)
  );

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <TableCell className="font-mono font-medium">{ip}</TableCell>
        <TableCell>
          <Badge variant="outline" className={sourceIP?.source === 'dns' ? 'border-teal-500/50 text-teal-400' : 'border-orange-500/50 text-orange-400'}>
            {sourceIP?.source === 'dns' ? 'DNS' : 'Firewall'}
          </Badge>
        </TableCell>
        <TableCell className="text-center">{result?.ports?.length ?? 0}</TableCell>
        <TableCell className="text-center">{(result?.services?.filter((s: AttackSurfaceService) => s.product).length ?? 0) + (result?.web_services?.length ?? 0)}</TableCell>
        <TableCell className="text-center">{ipCVEs.length}</TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{sourceIP?.label || '—'}</TableCell>
        <TableCell>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
      </TableRow>

      {open && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-muted/30 border-t border-border/50 p-4 space-y-3">
              {result?.error && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  {result.error}
                </div>
              )}

              {result?.os && (
                <div className="text-sm">
                  <span className="text-muted-foreground">OS: </span>
                  <span className="font-medium">{result.os}</span>
                </div>
              )}

              {result?.hostnames?.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Hostnames: </span>
                  <span className="font-mono text-xs">{result.hostnames.join(', ')}</span>
                </div>
              )}

              {result?.services?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Serviços Descobertos</h4>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Porta</TableHead>
                          <TableHead className="text-xs">Protocolo</TableHead>
                          <TableHead className="text-xs">Produto</TableHead>
                          <TableHead className="text-xs">Versão</TableHead>
                          <TableHead className="text-xs">Banner</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.services.map((svc: AttackSurfaceService, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{svc.port}</TableCell>
                            <TableCell className="text-xs">{svc.transport}</TableCell>
                            <TableCell className="text-xs font-medium">{svc.product || '—'}</TableCell>
                            <TableCell className="text-xs">{svc.version || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {svc.banner ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">{svc.banner.substring(0, 80)}...</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md">
                                    <pre className="text-xs whitespace-pre-wrap">{svc.banner}</pre>
                                  </TooltipContent>
                                </Tooltip>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Web Services from httpx */}
              {result?.web_services && result.web_services.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Web Services Detectados</h4>
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">URL</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Server</TableHead>
                          <TableHead className="text-xs">Tecnologias</TableHead>
                          <TableHead className="text-xs">TLS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.web_services.map((ws: AttackSurfaceWebService, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs max-w-[250px] truncate">
                              <a href={ws.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                                {ws.url}
                              </a>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={
                                ws.status_code >= 200 && ws.status_code < 300 ? 'border-primary/50 text-primary' :
                                ws.status_code >= 300 && ws.status_code < 400 ? 'border-warning/50 text-warning' :
                                'border-destructive/50 text-destructive'
                              }>
                                {ws.status_code}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{ws.server || '—'}</TableCell>
                            <TableCell className="text-xs">
                              {ws.technologies?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {ws.technologies.slice(0, 4).map((t, j) => (
                                    <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">
                                      {t}
                                    </Badge>
                                  ))}
                                  {ws.technologies.length > 4 && (
                                    <span className="text-muted-foreground text-[10px]">+{ws.technologies.length - 4}</span>
                                  )}
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ws.tls?.subject_cn ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help text-primary">🔒 {ws.tls.subject_cn}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1 text-xs">
                                        {ws.tls.issuer && <div><strong>Emissor:</strong> {Array.isArray(ws.tls.issuer) ? ws.tls.issuer.join(', ') : ws.tls.issuer}</div>}
                                        {ws.tls.version && <div><strong>Versão:</strong> {ws.tls.version}</div>}
                                        {ws.tls.cipher && <div><strong>Cipher:</strong> {ws.tls.cipher}</div>}
                                        {ws.tls.not_after && <div><strong>Expira:</strong> {ws.tls.not_after}</div>}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {ipCVEs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">CVEs Vinculadas</h4>
                  <div className="flex flex-wrap gap-2">
                    {ipCVEs.map((cve) => (
                      <a
                        key={cve.cve_id}
                        href={cve.advisory_url || `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5"
                      >
                        <SeverityBadge severity={cve.severity} />
                        <span className="text-xs font-mono">{cve.cve_id}</span>
                        {cve.score && <span className="text-xs text-muted-foreground">({cve.score})</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(!result?.services || result.services.length === 0) && (!result?.web_services || result.web_services.length === 0) && !result?.error && (
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para este IP.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AttackSurfaceAnalyzerPage() {
  const { effectiveRole } = useEffectiveAuth();
  const { data: userClientId } = useClientId();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const { data: workspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isSuperRole && workspaces?.length && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [isSuperRole, workspaces, selectedWorkspaceId]);

  const selectedClientId = isSuperRole ? selectedWorkspaceId : userClientId;

  const scanMutation = useAttackSurfaceScan(selectedClientId ?? undefined);
  const cancelMutation = useAttackSurfaceCancelScan(selectedClientId ?? undefined);
  const { data: snapshot, isLoading } = useLatestAttackSurfaceSnapshot(selectedClientId ?? undefined);
  const { data: progress } = useAttackSurfaceProgress(selectedClientId ?? undefined);

  const summary = snapshot?.summary ?? { total_ips: 0, open_ports: 0, services: 0, cves: 0 };
  const ips = snapshot?.source_ips ?? [];
  const isRunning = progress?.status === 'pending' || progress?.status === 'running';

  const statCards = [
    { label: 'IPs Públicos', value: summary.total_ips, icon: Network, color: 'text-teal-400' },
    { label: 'Portas Abertas', value: summary.open_ports, icon: Server, color: 'text-orange-400' },
    { label: 'Serviços', value: summary.services, icon: Activity, color: 'text-info' },
    { label: 'CVEs', value: summary.cves, icon: Bug, color: 'text-destructive' },
  ];

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[
            { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
            { label: 'Analyzer' },
          ]} />

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Radar className="w-7 h-7 text-teal-400" />
                Attack Surface Analyzer
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Análise automática de superfície de ataque — executada diariamente pelo Super Agent
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isSuperRole && workspaces && (
                <Select value={selectedWorkspaceId ?? ''} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="w-[220px]">
                    <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isSuperRole && !isRunning && (
                <Button
                  size="sm"
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                >
                  {scanMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Disparar Scan
                </Button>
              )}
              {isSuperRole && isRunning && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancelar Scan
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar when scan is running */}
          {isRunning && progress && (
            <Card className="glass-card border-teal-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span className="text-sm font-medium">Scan em andamento...</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {progress.done} de {progress.total} IPs processados
                  </span>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Score + Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="glass-card md:col-span-1 flex flex-col items-center justify-center p-6">
              <span className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Score de Exposição</span>
              <ExposureScoreGauge score={snapshot?.score ?? null} />
            </Card>

            {statCards.map((s) => (
              <Card key={s.label} className="glass-card">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Port Heatmap + Tech Stack */}
          {snapshot && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PortHeatmap snapshot={snapshot} />
              <TechStackSection snapshot={snapshot} />
            </div>
          )}

          {/* Last Scan Info */}
          {snapshot?.completed_at && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>Último scan concluído</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>
                  {formatDistanceToNow(new Date(snapshot.completed_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Timer className="w-4 h-4" />
                <span>{new Date(snapshot.completed_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}

          {/* Main Table */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-400" />
                IPs Públicos Descobertos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : ips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum dado disponível</p>
                  <p className="text-sm mt-1">O scan automático será executado diariamente às 00:00 UTC.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-center">Portas</TableHead>
                        <TableHead className="text-center">Serviços</TableHead>
                        <TableHead className="text-center">CVEs</TableHead>
                        <TableHead>Referência</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ips.map((sourceIP) => (
                        <IPDetailRow
                          key={sourceIP.ip}
                          ip={sourceIP.ip}
                          snapshot={snapshot!}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
