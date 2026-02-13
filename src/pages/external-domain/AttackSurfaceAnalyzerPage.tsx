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
  Activity,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radar,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Play,
  XCircle,
  Shield,
  Lock,
  ExternalLink,
  ShieldAlert,
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
  type AttackSurfaceCVE,
} from '@/hooks/useAttackSurfaceData';
import { Button } from '@/components/ui/button';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function getTechBadgeColor(tech: string): string {
  const t = tech.toLowerCase();
  if (['hsts', 'csp', 'x-frame-options', 'x-xss-protection'].some(k => t.includes(k)))
    return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (['nginx', 'apache', 'iis', 'litespeed', 'caddy'].some(k => t.includes(k)))
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (['php', 'python', 'node', 'java', 'ruby', 'asp.net', '.net'].some(k => t.includes(k)))
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  if (['wordpress', 'nextcloud', 'drupal', 'joomla', 'react', 'angular', 'vue', 'django', 'laravel'].some(k => t.includes(k)))
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return '';
}

/* ──────────────────────────── hooks ──────────────────────────── */

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

function useAttackSurfaceProgress(clientId?: string) {
  return useQuery({
    queryKey: ['attack-surface-progress', clientId],
    queryFn: async () => {
      if (!clientId) return null;
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
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

/* ──────────────────────────── small components ──────────────────────────── */

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


/* ──────────────────────────── Port Heatmap ──────────────────────────── */

function PortHeatmap({ snapshot }: { snapshot: AttackSurfaceSnapshot }) {
  const portCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(snapshot.results).forEach((r) => {
      (r.ports || []).forEach((p: number) => {
        counts[p] = (counts[p] || 0) + 1;
      });
      (r.web_services || []).forEach((ws: AttackSurfaceWebService) => {
        try {
          const url = new URL(ws.url);
          const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
          counts[port] = (counts[port] || 0) + 1;
        } catch { /* ignore */ }
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
                  <TooltipContent>Porta {port} — encontrada em {count} IP(s)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── Tech Stack ──────────────────────────── */

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

/* ──────────────────────────── CVE Alert Banner ──────────────────────────── */

function CVEAlertSection({ cves }: { cves: AttackSurfaceCVE[] }) {
  const grouped = useMemo(() => {
    if (!cves || cves.length === 0) return [];
    const order = ['critical', 'high', 'medium', 'low'];
    const sorted = [...cves].sort((a, b) => {
      const ai = order.indexOf(a.severity?.toLowerCase());
      const bi = order.indexOf(b.severity?.toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted;
  }, [cves]);

  if (grouped.length === 0) return null;

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
          <ShieldAlert className="w-4 h-4" />
          Vulnerabilidades Detectadas ({cves.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {grouped.map((cve) => (
            <div key={cve.cve_id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
              <SeverityBadge severity={cve.severity} />
              <a
                href={cve.advisory_url || `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-foreground hover:text-info transition-colors flex items-center gap-1.5"
              >
                {cve.cve_id}
                <ExternalLink className="w-3 h-3" />
              </a>
              {cve.score !== null && (
                <span className="text-xs font-mono text-muted-foreground">CVSS {cve.score}</span>
              )}
              <span className="text-xs text-muted-foreground truncate flex-1">{cve.title}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── Web Services Section ──────────────────────────── */

interface WebServiceRow {
  ip: string;
  label: string;
  ws: AttackSurfaceWebService;
}

function WebServicesSection({ snapshot }: { snapshot: AttackSurfaceSnapshot }) {
  const rows = useMemo(() => {
    const result: WebServiceRow[] = [];
    snapshot.source_ips.forEach((src) => {
      const ipResult = snapshot.results[src.ip];
      if (!ipResult?.web_services) return;
      ipResult.web_services.forEach((ws) => {
        result.push({ ip: src.ip, label: src.label, ws });
      });
    });
    return result;
  }, [snapshot]);

  if (rows.length === 0) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-400" />
          Web Services Descobertos ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">URL</TableHead>
                <TableHead className="text-xs">IP</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">Servidor</TableHead>
                
                <TableHead className="text-xs">Tecnologias</TableHead>
                <TableHead className="text-xs">TLS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} className="min-h-[48px]">
                  <TableCell className="font-mono text-xs max-w-[260px] truncate">
                    <a href={row.ws.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline flex items-center gap-1">
                      {row.ws.url}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono cursor-help">{row.ip}</span>
                        </TooltipTrigger>
                        <TooltipContent>{row.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={
                      row.ws.status_code >= 200 && row.ws.status_code < 300 ? 'border-primary/50 text-primary' :
                      row.ws.status_code >= 300 && row.ws.status_code < 400 ? 'border-warning/50 text-warning' :
                      'border-destructive/50 text-destructive'
                    }>
                      {row.ws.status_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.ws.server || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {row.ws.technologies?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.ws.technologies.map((t, j) => (
                          <Badge key={j} variant="outline" className={cn("text-[10px] px-1.5 py-0 truncate max-w-[120px]", getTechBadgeColor(t))}>{t}</Badge>
                        ))}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.ws.tls?.subject_cn ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Lock className="w-3 h-3" />
                        {row.ws.tls.subject_cn}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── TLS Certificates Section ──────────────────────────── */

interface TLSCertInfo {
  subject_cn: string;
  issuer: string;
  not_after: string | null;
  ip: string;
  url: string;
  daysRemaining: number | null;
}

function TLSCertificatesSection({ snapshot }: { snapshot: AttackSurfaceSnapshot }) {
  const certs = useMemo(() => {
    const seen = new Map<string, TLSCertInfo>();
    snapshot.source_ips.forEach((src) => {
      const ipResult = snapshot.results[src.ip];
      if (!ipResult?.web_services) return;
      ipResult.web_services.forEach((ws) => {
        if (!ws.tls?.subject_cn) return;
        const key = `${ws.tls.subject_cn}__${ws.tls.not_after ?? ''}`;
        if (seen.has(key)) return;
        const issuer = ws.tls.issuer
          ? (Array.isArray(ws.tls.issuer) ? ws.tls.issuer.join(', ') : ws.tls.issuer)
          : '—';
        let daysRemaining: number | null = null;
        if (ws.tls.not_after) {
          try {
            daysRemaining = differenceInDays(parseISO(ws.tls.not_after), new Date());
          } catch { /* ignore */ }
        }
        seen.set(key, {
          subject_cn: ws.tls.subject_cn,
          issuer,
          not_after: ws.tls.not_after ?? null,
          ip: src.ip,
          url: ws.url,
          daysRemaining,
        });
      });
    });
    return Array.from(seen.values()).sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));
  }, [snapshot]);

  if (certs.length === 0) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Certificados TLS ({certs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Common Name</TableHead>
                <TableHead className="text-xs">Emissor</TableHead>
                <TableHead className="text-xs">IP</TableHead>
                <TableHead className="text-xs">Expira em</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((cert, i) => {
                const isExpiringSoon = cert.daysRemaining !== null && cert.daysRemaining <= 30;
                const isExpired = cert.daysRemaining !== null && cert.daysRemaining < 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs font-medium">{cert.subject_cn}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cert.issuer}</TableCell>
                    <TableCell className="text-xs font-mono">{cert.ip}</TableCell>
                    <TableCell className="text-xs">
                      {cert.not_after
                        ? new Date(cert.not_after).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {isExpired ? (
                        <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
                          Expirado
                        </Badge>
                      ) : isExpiringSoon ? (
                        <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-[10px]">
                          {cert.daysRemaining}d restantes
                        </Badge>
                      ) : cert.daysRemaining !== null ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          {cert.daysRemaining}d restantes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── IP Detail Row ──────────────────────────── */

function IPDetailRow({ ip, snapshot }: { ip: string; snapshot: AttackSurfaceSnapshot }) {
  const [open, setOpen] = useState(false);
  const sourceIP = snapshot.source_ips.find((s) => s.ip === ip);
  const result = snapshot.results[ip];
  const ipCVEs = snapshot.cve_matches.filter((c) => result?.vulns?.includes(c.cve_id));
  const serviceCount = (result?.services?.filter((s: AttackSurfaceService) => s.product).length ?? 0);
  const webCount = result?.web_services?.length ?? 0;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <TableCell className="font-mono font-medium">{ip}</TableCell>
        <TableCell>
          <Badge variant="outline" className={sourceIP?.source === 'dns' ? 'border-teal-500/50 text-teal-400' : 'border-orange-500/50 text-orange-400'}>
            {sourceIP?.source === 'dns' ? 'DNS' : 'Firewall'}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{sourceIP?.label || '—'}</TableCell>
        <TableCell>
          {result?.ports?.length ? (
            <div className="flex flex-wrap gap-1">
              {result.ports.map((port: number) => (
                <Badge key={port} variant="outline" className="font-mono text-[10px] px-1.5 py-0">{port}</Badge>
              ))}
            </div>
          ) : <span className="text-muted-foreground font-mono">—</span>}
        </TableCell>
        <TableCell>
          {(() => {
            const names = [
              ...(result?.services?.filter((s: AttackSurfaceService) => s.product).map((s: AttackSurfaceService) => s.product) ?? []),
              ...(result?.web_services?.map((w: any) => w.tech || w.server).filter(Boolean) ?? []),
            ];
            const unique = [...new Set(names)];
            return unique.length ? (
              <div className="flex flex-wrap gap-1">
                {unique.map((name) => (
                  <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">{name}</Badge>
                ))}
              </div>
            ) : <span className="text-muted-foreground font-mono">—</span>;
          })()}
        </TableCell>
        <TableCell className="text-center">
          {ipCVEs.length > 0 ? (
            <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">{ipCVEs.length}</Badge>
          ) : (
            <span className="text-muted-foreground font-mono">0</span>
          )}
        </TableCell>
        <TableCell>{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
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
                          <TableHead className="text-xs">CPE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.services.map((svc: AttackSurfaceService, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{svc.port}</TableCell>
                            <TableCell className="text-xs">{svc.transport}</TableCell>
                            <TableCell className="text-xs font-medium">{svc.product || '—'}</TableCell>
                            <TableCell className="text-xs">{svc.version || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[250px]">
                              {svc.cpe?.length > 0 ? svc.cpe.join(', ') : '—'}
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

              {(!result?.services || result.services.length === 0) && !result?.error && (
                <p className="text-sm text-muted-foreground">Nenhum serviço identificado neste IP.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ──────────────────────────── Page ──────────────────────────── */

export default function AttackSurfaceAnalyzerPage() {
  const { effectiveRole } = useEffectiveAuth();
  const { data: userClientId } = useClientId();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const { data: workspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
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


  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 lg:p-8 space-y-6">
          <PageBreadcrumb items={[
            { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
            { label: 'Analyzer' },
          ]} />

          {/* Header */}
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
                <Button size="sm" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
                  {scanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Disparar Scan
                </Button>
              )}
              {isSuperRole && isRunning && (
                <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Cancelar Scan
                </Button>
              )}
            </div>
          </div>

          {/* Progress */}
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

          {/* ── CVE Alert Banner ── */}
          {snapshot && <CVEAlertSection cves={snapshot.cve_matches} />}

          {/* ── 3. Port Heatmap + Tech Stack ── */}
          {snapshot && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PortHeatmap snapshot={snapshot} />
              <TechStackSection snapshot={snapshot} />
            </div>
          )}

          {/* ── 4. Web Services ── */}
          {snapshot && <WebServicesSection snapshot={snapshot} />}

          {/* ── 5. TLS Certificates ── */}
          {snapshot && <TLSCertificatesSection snapshot={snapshot} />}

          {/* ── 6. IP Inventory Table ── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-400" />
                Inventário de IPs Públicos
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
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Referência</TableHead>
                        <TableHead className="text-center">Portas</TableHead>
                        <TableHead className="text-center">Serviços</TableHead>
                        <TableHead className="text-center">CVEs</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ips.map((sourceIP) => (
                        <IPDetailRow key={sourceIP.ip} ip={sourceIP.ip} snapshot={snapshot!} />
                      ))}
                    </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Last scan timestamp */}
          {snapshot?.completed_at && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground pb-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                Último scan concluído em {new Date(snapshot.completed_at).toLocaleString('pt-BR')}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
