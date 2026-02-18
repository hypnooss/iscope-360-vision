import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirewallCVEs, FirewallCVE, getOsLabel } from '@/hooks/useFirewallCVEs';
import { AlertTriangle, ShieldAlert, Shield, ChevronDown, ChevronRight, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-orange-600 text-white',
  MEDIUM: 'bg-warning text-warning-foreground',
  LOW: 'bg-muted text-muted-foreground',
  UNKNOWN: 'bg-muted text-muted-foreground',
};

const VENDOR_ADVISORY: Record<string, { label: string; baseUrl: string }> = {
  fortinet: { label: 'Fortiguard PSIRT', baseUrl: 'https://www.fortiguard.com/psirt' },
  sonicwall: { label: 'SonicWall PSIRT', baseUrl: 'https://psirt.global.sonicwall.com' },
};

function getAdvisoryUrl(cve: FirewallCVE): string | null {
  const config = VENDOR_ADVISORY[cve.vendor];
  if (!config) return null;

  // Check if any reference matches the vendor advisory
  const advisoryRef = cve.references?.find((r) =>
    config.baseUrl.split('//')[1]?.split('/')[0]
      ? r.includes(config.baseUrl.split('//')[1].split('/')[0])
      : false
  );
  return advisoryRef || null;
}

function CVECard({ cve }: { cve: FirewallCVE }) {
  const [open, setOpen] = useState(false);

  const isNew = (() => {
    if (!cve.publishedDate) return false;
    const published = new Date(cve.publishedDate);
    const now = new Date();
    return (now.getTime() - published.getTime()) / (1000 * 3600 * 24) <= 30;
  })();

  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.id}`;
  const advisoryUrl = getAdvisoryUrl(cve);
  const advisoryConfig = VENDOR_ADVISORY[cve.vendor];
  const osLabel = getOsLabel(cve.vendor);

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
                      {osLabel} {cve.firmwareVersion}
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
              {advisoryUrl && advisoryConfig && (
                <a
                  href={advisoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Ver advisory {advisoryConfig.label}
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
  const [months, setMonths] = useState(3);

  const { data, isLoading, error } = useFirewallCVEs();

  // Derive dynamic title and disclaimer from vendors present
  const vendors = data?.vendors || [];
  const pageTitle = 'CVEs - Firewalls';

  const disclaimerText = useMemo(() => {
    const vendorLabels = vendors.map((v) => {
      switch (v) {
        case 'fortinet': return 'Fortinet';
        case 'sonicwall': return 'SonicWall';
        default: return v;
      }
    });
    const joined = vendorLabels.length > 0 ? vendorLabels.join('/') : 'dos fabricantes';
    return `Dados fornecidos pelo NIST National Vulnerability Database (NVD). Verifique os advisories oficiais da ${joined} para informações precisas.`;
  }, [vendors]);

  // Filter CVEs by published date (months)
  const cvesFilteredByDate = useMemo(() => {
    if (!data?.cves) return [];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return data.cves.filter((cve) => {
      if (!cve.publishedDate) return true;
      return new Date(cve.publishedDate) >= cutoff;
    });
  }, [data?.cves, months]);

  const filteredCves = useMemo(() => {
    return cvesFilteredByDate.filter((cve) => {
      if (selectedVersions.length > 0 && !selectedVersions.includes(`${cve.vendor}:${cve.firmwareVersion}`)) {
        return false;
      }
      if (severityFilter !== 'all' && cve.severity !== severityFilter) {
        return false;
      }
      return true;
    });
  }, [cvesFilteredByDate, selectedVersions, severityFilter]);

  const stats = useMemo(() => {
    return {
      total: cvesFilteredByDate.length,
      critical: cvesFilteredByDate.filter((c) => c.severity === 'CRITICAL').length,
      high: cvesFilteredByDate.filter((c) => c.severity === 'HIGH').length,
      medium: cvesFilteredByDate.filter((c) => c.severity === 'MEDIUM').length,
      low: cvesFilteredByDate.filter((c) => c.severity === 'LOW').length,
    };
  }, [cvesFilteredByDate]);

  const toggleVersion = (key: string) => {
    setSelectedVersions((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
    );
  };

  const versionInfos = data?.versionInfos || [];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        <PageBreadcrumb items={[
          { label: 'Compliance', href: '/scope-firewall/reports' },
          { label: 'CVEs' },
        ]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-muted-foreground">
              Vulnerabilidades conhecidas nas versões de firmware dos firewalls cadastrados
            </p>
          </div>
          <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
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
        {versionInfos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Versões:</span>
            {versionInfos.map((info) => {
              const key = `${info.vendor}:${info.version}`;
              const label = `${getOsLabel(info.vendor)} ${info.version}`;
              return (
                <Button
                  key={key}
                  variant={selectedVersions.includes(key) ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => toggleVersion(key)}
                >
                  {label}
                </Button>
              );
            })}
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
              {versionInfos.length === 0
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
          {disclaimerText}
        </p>
      </div>
    </AppLayout>
  );
}
