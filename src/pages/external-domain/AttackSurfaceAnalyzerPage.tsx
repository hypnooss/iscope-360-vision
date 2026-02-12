import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Globe,
  Shield,
  Server,
  Bug,
  Activity,
  ChevronDown,
  ChevronRight,
  Loader2,
  Radar,
  AlertTriangle,
  Network,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useLatestAttackSurfaceSnapshot,
  useAttackSurfaceScan,
  type AttackSurfaceSnapshot,
  type AttackSurfaceService,
} from '@/hooks/useAttackSurfaceData';

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

function ScoreIndicator({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">—</span>;
  const color =
    score >= 70 ? 'text-destructive' : score >= 40 ? 'text-warning' : 'text-primary';
  return (
    <span className={`font-mono font-bold text-lg ${color}`}>
      {score}
    </span>
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(!open)}>
        <TableCell className="font-mono font-medium">{ip}</TableCell>
        <TableCell>
          <Badge variant="outline" className={sourceIP?.source === 'dns' ? 'border-teal-500/50 text-teal-400' : 'border-orange-500/50 text-orange-400'}>
            {sourceIP?.source === 'dns' ? 'DNS' : 'Firewall'}
          </Badge>
        </TableCell>
        <TableCell className="text-center">{result?.ports?.length ?? 0}</TableCell>
        <TableCell className="text-center">{result?.services?.filter((s: AttackSurfaceService) => s.product).length ?? 0}</TableCell>
        <TableCell className="text-center">{ipCVEs.length}</TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{sourceIP?.label || '—'}</TableCell>
        <TableCell>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
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
                <p className="text-sm text-muted-foreground">Nenhum dado disponível para este IP.</p>
              )}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AttackSurfaceAnalyzerPage() {
  const { data: clientId } = useClientId();
  const { data: snapshot, isLoading } = useLatestAttackSurfaceSnapshot(clientId ?? undefined);
  const scanMutation = useAttackSurfaceScan(clientId ?? undefined);

  const summary = snapshot?.summary ?? { total_ips: 0, open_ports: 0, services: 0, cves: 0 };
  const ips = snapshot?.source_ips ?? [];

  const statCards = [
    { label: 'IPs Públicos', value: summary.total_ips, icon: Network, color: 'text-teal-400' },
    { label: 'Portas Abertas', value: summary.open_ports, icon: Server, color: 'text-orange-400' },
    { label: 'Serviços', value: summary.services, icon: Activity, color: 'text-info' },
    { label: 'CVEs', value: summary.cves, icon: Bug, color: 'text-destructive' },
  ];

  return (
    <AppLayout>
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
              Análise de superfície de ataque — IPs públicos, portas e serviços expostos
            </p>
          </div>

          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || !clientId}
            className="gap-2"
          >
            {scanMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Radar className="w-4 h-4" />
            )}
            Executar Scan
          </Button>
        </div>

        {/* Score + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="glass-card md:col-span-1 flex flex-col items-center justify-center p-6">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Score de Exposição</span>
            <ScoreIndicator score={snapshot?.score ?? null} />
            <span className="text-xs text-muted-foreground mt-1">
              {snapshot?.score != null
                ? snapshot.score >= 70 ? 'Alto Risco' : snapshot.score >= 40 ? 'Risco Moderado' : 'Baixo Risco'
                : 'Sem dados'}
            </span>
          </Card>

          {statCards.map((s) => (
            <Card key={s.label} className="glass-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-2.5 rounded-lg bg-muted/50`}>
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
                <p className="text-sm mt-1">Execute um scan para descobrir IPs públicos e serviços expostos.</p>
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

            {snapshot?.completed_at && (
              <p className="text-xs text-muted-foreground mt-3">
                Último scan: {new Date(snapshot.completed_at).toLocaleString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
