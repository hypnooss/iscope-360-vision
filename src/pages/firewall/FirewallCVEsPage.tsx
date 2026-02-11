import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirewallCVEs, FirewallCVE } from '@/hooks/useFirewallCVEs';
import { AlertTriangle, ShieldAlert, Shield, ChevronDown, ChevronRight, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-orange-600 text-white',
  MEDIUM: 'bg-warning text-warning-foreground',
  LOW: 'bg-muted text-muted-foreground',
  UNKNOWN: 'bg-muted text-muted-foreground',
};

function CVECard({ cve }: { cve: FirewallCVE }) {
  const [open, setOpen] = useState(false);

  const isNew = (() => {
    if (!cve.publishedDate) return false;
    const published = new Date(cve.publishedDate);
    const now = new Date();
    return (now.getTime() - published.getTime()) / (1000 * 3600 * 24) <= 30;
  })();

  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.id}`;
  const fortiguardUrl = cve.references?.find(r => r.includes('fortiguard')) || nvdUrl;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-border/50">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn('text-xs font-bold', SEVERITY_COLORS[cve.severity])}>
                      {cve.severity}
                    </Badge>
                    {isNew && (
                      <Badge className="text-xs font-bold bg-emerald-500 text-white border-emerald-500 animate-pulse">
                        NEW
                      </Badge>
                    )}
                    {cve.score != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        CVSS {cve.score.toFixed(1)}
                      </span>
                    )}
                    <a
                      href={nvdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {cve.id}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">
                    {cve.affectedVersions || cve.id}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] py-0">
                      FortiOS {cve.firmwareVersion}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-1">
                      {new Date(cve.publishedDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="pt-1">
                  {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
              {cve.description || 'Descrição não disponível.'}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <a
                href={nvdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver detalhes no NVD
                <ExternalLink className="w-3 h-3" />
              </a>
              {fortiguardUrl !== nvdUrl && (
                <a
                  href={fortiguardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Ver advisory Fortiguard PSIRT
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function FirewallCVEsPage() {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { data, isLoading, error } = useFirewallCVEs();

  const filteredCves = useMemo(() => {
    if (!data?.cves) return [];
    return data.cves.filter((cve) => {
      if (selectedVersions.length > 0 && !selectedVersions.includes(cve.firmwareVersion)) {
        return false;
      }
      if (severityFilter !== 'all' && cve.severity !== severityFilter) {
        return false;
      }
      return true;
    });
  }, [data?.cves, selectedVersions, severityFilter]);

  const stats = useMemo(() => {
    const cves = data?.cves ?? [];
    return {
      total: cves.length,
      critical: cves.filter((c) => c.severity === 'CRITICAL').length,
      high: cves.filter((c) => c.severity === 'HIGH').length,
      medium: cves.filter((c) => c.severity === 'MEDIUM').length,
      low: cves.filter((c) => c.severity === 'LOW').length,
    };
  }, [data?.cves]);

  const toggleVersion = (version: string) => {
    setSelectedVersions((prev) =>
      prev.includes(version) ? prev.filter((v) => v !== version) : [...prev, version]
    );
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        <PageBreadcrumb items={[
          { label: 'Scope Firewall', href: '/scope-firewall/firewalls' },
          { label: 'CVEs' },
        ]} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">CVEs - FortiOS</h1>
          <p className="text-muted-foreground">
            Vulnerabilidades conhecidas nas versões de firmware dos firewalls cadastrados
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total CVEs" value={stats.total} icon={Shield} variant="default" delay={0} compact onClick={() => setSeverityFilter('all')} active={severityFilter === 'all'} />
          <StatCard title="Críticos" value={stats.critical} icon={ShieldAlert} variant="destructive" delay={0.05} compact onClick={() => setSeverityFilter(prev => prev === 'CRITICAL' ? 'all' : 'CRITICAL')} active={severityFilter === 'CRITICAL'} />
          <StatCard title="Altos" value={stats.high} icon={AlertTriangle} variant="warning" delay={0.1} compact onClick={() => setSeverityFilter(prev => prev === 'HIGH' ? 'all' : 'HIGH')} active={severityFilter === 'HIGH'} />
          <StatCard title="Médios" value={stats.medium} icon={Info} variant="warning" delay={0.15} compact onClick={() => setSeverityFilter(prev => prev === 'MEDIUM' ? 'all' : 'MEDIUM')} active={severityFilter === 'MEDIUM'} />
          <StatCard title="Baixos" value={stats.low} icon={Shield} variant="default" delay={0.2} compact onClick={() => setSeverityFilter(prev => prev === 'LOW' ? 'all' : 'LOW')} active={severityFilter === 'LOW'} />
        </div>

        {/* Version Filters */}
        {data?.versions && data.versions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Versões:</span>
            {data.versions.map((version) => (
              <Button
                key={version}
                variant={selectedVersions.includes(version) ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => toggleVersion(version)}
              >
                {version}
              </Button>
            ))}
            {selectedVersions.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedVersions([])}>
                Limpar
              </Button>
            )}
          </div>
        )}

        {/* CVE List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive">Erro ao carregar CVEs: {(error as Error).message}</p>
          </Card>
        ) : filteredCves.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">
              {data?.versions?.length === 0
                ? 'Nenhuma versão de firmware encontrada. Execute uma análise em pelo menos um firewall.'
                : 'Nenhum CVE encontrado para os filtros selecionados.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredCves.map((cve) => (
              <CVECard key={cve.id} cve={cve} />
            ))}
          </div>
        )}

        {/* Source disclaimer */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Dados fornecidos pelo NIST National Vulnerability Database (NVD). Verifique os advisories oficiais da Fortinet para informações precisas.
        </p>
      </div>
    </AppLayout>
  );
}
