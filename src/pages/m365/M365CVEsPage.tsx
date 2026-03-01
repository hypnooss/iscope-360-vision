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
import { useM365CVEs, M365CVE } from '@/hooks/useM365CVEs';
import { AlertTriangle, ShieldAlert, Shield, ChevronDown, ChevronRight, ExternalLink, Bug, Info, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_PRODUCTS = [
  'Exchange Online',
  'SharePoint Online',
  'Entra ID',
  'Teams',
  'Outlook',
  'Defender',
  'Intune',
  'OneDrive',
  'Microsoft 365 Apps',
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-orange-600 text-white',
  MEDIUM: 'bg-warning text-warning-foreground',
  LOW: 'bg-muted text-muted-foreground',
  UNKNOWN: 'bg-muted text-muted-foreground',
};

function CVECard({ cve }: { cve: M365CVE }) {
  const [open, setOpen] = useState(false);

  const isNew = (() => {
    if (!cve.publishedDate) return false;
    const published = new Date(cve.publishedDate);
    const now = new Date();
    return (now.getTime() - published.getTime()) / (1000 * 3600 * 24) <= 30;
  })();

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
                    {cve.customerActionRequired && (
                      <Badge className="text-xs font-bold bg-orange-500 text-white border-orange-500">
                        Ação Necessária
                      </Badge>
                    )}
                    {cve.score != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        CVSS {cve.score.toFixed(1)}
                      </span>
                    )}
                    <a
                      href={cve.advisoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {cve.id}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <CardTitle className="text-sm font-medium leading-snug">{cve.title}</CardTitle>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {cve.products.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] py-0">
                        {p}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">{cve.publishedDate}</span>
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
            <a
              href={cve.advisoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
            >
              Ver advisory completo na Microsoft
              <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function M365CVEsPage() {
  const [months, setMonths] = useState(3);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState(false);

  const { data, isLoading, error } = useM365CVEs(months);

  const filteredCves = useMemo(() => {
    if (!data?.cves) return [];
    return data.cves.filter((cve) => {
      if (selectedProducts.length > 0 && !cve.products.some((p) => selectedProducts.includes(p))) {
        return false;
      }
      if (severityFilter !== 'all' && cve.severity !== severityFilter) {
        return false;
      }
      if (actionFilter && !cve.customerActionRequired) {
        return false;
      }
      return true;
    });
  }, [data?.cves, selectedProducts, severityFilter, actionFilter]);

  const stats = useMemo(() => {
    const cves = data?.cves ?? [];
    return {
      total: cves.length,
      critical: cves.filter((c) => c.severity === 'CRITICAL').length,
      high: cves.filter((c) => c.severity === 'HIGH').length,
      medium: cves.filter((c) => c.severity === 'MEDIUM').length,
      low: cves.filter((c) => c.severity === 'LOW').length,
      actionRequired: cves.filter((c) => c.customerActionRequired).length,
    };
  }, [data?.cves]);

  const toggleProduct = (product: string) => {
    setSelectedProducts((prev) =>
      prev.includes(product) ? prev.filter((p) => p !== product) : [...prev, product]
    );
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/compliance' },
          { label: 'CVEs' },
        ]} />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              CVEs - Microsoft 365
            </h1>
            <p className="text-muted-foreground">
              Vulnerabilidades conhecidas nos produtos do ecossistema Microsoft 365
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
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <StatCard title="Total CVEs" value={stats.total} icon={Shield} variant="default" delay={0} compact onClick={() => { setSeverityFilter('all'); setActionFilter(false); }} active={severityFilter === 'all' && !actionFilter} />
          <StatCard title="Críticos" value={stats.critical} icon={ShieldAlert} variant="destructive" delay={0.05} compact onClick={() => { setActionFilter(false); setSeverityFilter(prev => prev === 'CRITICAL' ? 'all' : 'CRITICAL'); }} active={severityFilter === 'CRITICAL'} />
          <StatCard title="Altos" value={stats.high} icon={AlertTriangle} variant="warning" delay={0.1} compact onClick={() => { setActionFilter(false); setSeverityFilter(prev => prev === 'HIGH' ? 'all' : 'HIGH'); }} active={severityFilter === 'HIGH'} />
          <StatCard title="Médios" value={stats.medium} icon={Info} variant="warning" delay={0.15} compact onClick={() => { setActionFilter(false); setSeverityFilter(prev => prev === 'MEDIUM' ? 'all' : 'MEDIUM'); }} active={severityFilter === 'MEDIUM'} />
          <StatCard title="Baixos" value={stats.low} icon={Shield} variant="default" delay={0.2} compact onClick={() => { setActionFilter(false); setSeverityFilter(prev => prev === 'LOW' ? 'all' : 'LOW'); }} active={severityFilter === 'LOW'} />
          <StatCard title="Ação Necessária" value={stats.actionRequired} icon={UserCheck} variant="destructive" delay={0.25} compact onClick={() => { setSeverityFilter('all'); setActionFilter(prev => !prev); }} active={actionFilter} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Produtos:</span>
          {ALL_PRODUCTS.map((product) => (
            <Button
              key={product}
              variant={selectedProducts.includes(product) ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => toggleProduct(product)}
            >
              {product}
            </Button>
          ))}
          {selectedProducts.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedProducts([])}>
              Limpar
            </Button>
          )}
        </div>

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
            <p className="text-muted-foreground">Nenhum CVE encontrado para os filtros selecionados.</p>
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
          Dados fornecidos pelo Microsoft Security Response Center (MSRC). Atualização mensal no Patch Tuesday.
        </p>
      </div>
    </AppLayout>
  );
}
