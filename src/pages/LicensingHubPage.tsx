import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useLicensingHub, getLicenseStatus, LicenseStatus, FirewallLicense, DomainWhois } from '@/hooks/useLicensingHub';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Key, Shield, Globe, Cloud, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, Info, Building2, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

// ====== Sortable Head ======

type SortDir = 'asc' | 'desc' | null;

function SortableHead({ label, sortKey: colKey, activeSortKey, sortDir, onSort, className }: {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = activeSortKey === colKey;
  const Icon = isActive && sortDir === 'asc' ? ArrowUp : isActive && sortDir === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground transition-colors -my-1"
        onClick={() => onSort(colKey)}
      >
        {label}
        <Icon className={`w-3 h-3 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
      </button>
    </TableHead>
  );
}

function usePersistentSort(storageKey: string) {
  const [sortKey, setSortKey] = useState<string | null>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s).key : null; } catch { return null; }
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s).dir : null; } catch { return null; }
  });

  const handleSort = (key: string) => {
    let newKey: string | null, newDir: SortDir;
    if (sortKey !== key) { newKey = key; newDir = 'asc'; }
    else if (sortDir === 'asc') { newKey = key; newDir = 'desc'; }
    else { newKey = null; newDir = null; }
    setSortKey(newKey); setSortDir(newDir);
    if (newKey && newDir) localStorage.setItem(storageKey, JSON.stringify({ key: newKey, dir: newDir }));
    else localStorage.removeItem(storageKey);
  };

  return { sortKey, sortDir, handleSort };
}

function sortItems<T>(items: T[], sortKey: string | null, sortDir: SortDir, getVal: (item: T, key: string) => string | number | null): T[] {
  if (!sortKey || !sortDir) return items;
  const mul = sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = getVal(a, sortKey);
    const vb = getVal(b, sortKey);
    if (typeof va === 'number' || typeof vb === 'number') {
      const na = typeof va === 'number' ? va : (sortDir === 'asc' ? Infinity : -Infinity);
      const nb = typeof vb === 'number' ? vb : (sortDir === 'asc' ? Infinity : -Infinity);
      return (na - nb) * mul;
    }
    return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { sensitivity: 'base' }) * mul;
  });
}

// ====== Helpers ======

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

// ====== Badges ======

const ExpiryBadge = ({ daysLeft, expiresAt }: { daysLeft: number | null; expiresAt?: string | null }) => {
  const status = getLicenseStatus(daysLeft);
  const dateStr = formatDate(expiresAt ?? null);

  if (status === 'expired') {
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{dateStr ? `${dateStr} (expirado)` : 'Expirado'}</Badge>;
  }
  if (status === 'expiring') {
    return <Badge className="bg-warning/20 text-warning border-warning/30">{dateStr ? `${dateStr} (${daysLeft}d)` : `${daysLeft}d restantes`}</Badge>;
  }
  if (status === 'active') {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{dateStr ? `${dateStr} (${daysLeft}d)` : 'Ativo'}</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">Sem data</Badge>;
};

const CheckStatusBadge = ({ status }: { status: string }) => {
  if (status === 'pass') {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">OK</Badge>;
  }
  if (status === 'fail') {
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Falha</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">{status}</Badge>;
};

// ====== Filter helper ======

function matchesFilter(daysLeft: number | null, filter: LicenseStatus | null): boolean {
  if (!filter) return true;
  return getLicenseStatus(daysLeft) === filter;
}

// Group services by expiry date for compact display
function groupServicesByExpiry(services: { name: string; daysLeft: number | null; expiresAt: string | null }[]) {
  const groups = new Map<string, { names: string[]; daysLeft: number | null; expiresAt: string | null }>();
  for (const svc of services) {
    const key = svc.expiresAt ?? '__no_date__';
    const existing = groups.get(key);
    if (existing) {
      existing.names.push(svc.name);
    } else {
      groups.set(key, { names: [svc.name], daysLeft: svc.daysLeft, expiresAt: svc.expiresAt });
    }
  }
  return Array.from(groups.values());
}

// ====== EOL Hook ======

interface EolData {
  title: string;
  endOfOrder: string | null;
  lastServiceExtension: string | null;
  endOfSupport: string | null;
}

function useFortinetEol(models: string[]) {
  const uniqueModels = useMemo(() => [...new Set(models.filter(Boolean))], [models]);

  return useQuery({
    queryKey: ['fortinet-eol', uniqueModels],
    queryFn: async () => {
      const results: Record<string, EolData | null> = {};
      await Promise.all(
        uniqueModels.map(async (model) => {
          try {
            const { data, error } = await supabase.functions.invoke('fortinet-hardware-eol', {
              body: { model },
            });
            results[model] = error ? null : data?.data ?? null;
          } catch {
            results[model] = null;
          }
        })
      );
      return results;
    },
    enabled: uniqueModels.length > 0,
    staleTime: 30 * 60 * 1000, // 30 min
  });
}

// ====== EOL Badge ======

function EolBadges({ eol }: { eol: EolData | null | undefined }) {
  if (eol === undefined) return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
  if (!eol) return <span className="text-xs text-muted-foreground">Sem dados de EOL</span>;

  const items = [
    { label: 'End of Order', date: eol.endOfOrder, abbr: 'EoO' },
    { label: 'Last Svc Ext', date: eol.lastServiceExtension, abbr: 'LSE' },
    { label: 'End of Support', date: eol.endOfSupport, abbr: 'EoS' },
  ].filter(i => i.date);

  if (!items.length) return <span className="text-xs text-muted-foreground">Sem datas de EOL</span>;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {items.map(item => {
          const d = new Date(item.date!);
          const isPast = d < new Date();
          return (
            <Tooltip key={item.abbr}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={isPast
                    ? 'bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5'
                    : 'text-muted-foreground text-[10px] px-1.5'}
                >
                  {item.abbr}: {formatDate(item.date)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent><p>{item.label}: {item.date}</p></TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// ====== Page ======

export default function LicensingHubPage() {
  const queryClient = useQueryClient();
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    isSuperRole,
    firewallLicenses,
    tlsCertificates,
    m365Licenses,
    domainWhois,
    summary,
    loading,
    refreshM365Licenses,
    refreshingM365,
  } = useLicensingHub();

  const firewallModels = useMemo(() => firewallLicenses.map(fw => fw.model || ''), [firewallLicenses]);
  const { data: eolMap, isLoading: loadingEol } = useFortinetEol(firewallModels);

  const [activeFilter, setActiveFilter] = useState<LicenseStatus | null>(null);
  const [activeTab, setActiveTab] = useState('firewalls');
  const [showOldExpired, setShowOldExpired] = useState(false);

  // Persistent sort per tab
  const fwSort = usePersistentSort('licensing-sort-firewalls');
  const tlsSort = usePersistentSort('licensing-sort-tls');
  const domSort = usePersistentSort('licensing-sort-domains');
  const m365Sort = usePersistentSort('licensing-sort-m365');

  // Tab-specific summary
  const displaySummary = useMemo(() => {
    const countStatus = (items: { daysLeft: number | null }[]) => {
      let expired = 0, expiring = 0, active = 0;
      for (const item of items) {
        const s = getLicenseStatus(item.daysLeft);
        if (s === 'expired') expired++;
        else if (s === 'expiring') expiring++;
        else if (s === 'active') active++;
      }
      return { expired, expiring, active, total: items.length };
    };

    if (activeTab === 'firewalls') {
      const allItems: { daysLeft: number | null }[] = [];
      for (const fw of firewallLicenses) {
        allItems.push({ daysLeft: fw.forticare.daysLeft });
        fw.services.forEach(svc => allItems.push({ daysLeft: svc.daysLeft }));
      }
      return countStatus(allItems);
    }
    if (activeTab === 'tls') {
      return countStatus(tlsCertificates);
    }
    if (activeTab === 'domains') {
      return countStatus(domainWhois);
    }
    // m365 — exclude suspended and long-expired from summary
    const relevantM365 = m365Licenses.filter(lic =>
      lic.capabilityStatus !== 'Suspended' &&
      (lic.daysLeft === null || lic.daysLeft >= -60)
    );
    return countStatus(relevantM365);
  }, [activeTab, firewallLicenses, tlsCertificates, m365Licenses, domainWhois]);

  const toggleFilter = (status: LicenseStatus) => {
    setActiveFilter(prev => (prev === status ? null : status));
  };

  // Filtered data
  const filteredFirewalls = useMemo(() => {
    if (!activeFilter) return firewallLicenses;
    return firewallLicenses.filter(fw => {
      if (matchesFilter(fw.forticare.daysLeft, activeFilter)) return true;
      return fw.services.some(svc => matchesFilter(svc.daysLeft, activeFilter));
    });
  }, [firewallLicenses, activeFilter]);

  const filteredTls = useMemo(() => {
    if (!activeFilter) return tlsCertificates;
    return tlsCertificates.filter(cert => matchesFilter(cert.daysLeft, activeFilter));
  }, [tlsCertificates, activeFilter]);

  const filteredM365 = useMemo(() => {
    if (!activeFilter) return m365Licenses;
    return m365Licenses.filter(lic => matchesFilter(lic.daysLeft, activeFilter));
  }, [m365Licenses, activeFilter]);

  const filteredDomains = useMemo(() => {
    if (!activeFilter) return domainWhois;
    return domainWhois.filter(d => matchesFilter(d.daysLeft, activeFilter));
  }, [domainWhois, activeFilter]);

  // Sorted data
  const sortedFirewalls = useMemo(() => sortItems(filteredFirewalls, fwSort.sortKey, fwSort.sortDir, (fw, key) => {
    if (key === 'firewallName') return fw.firewallName;
    if (key === 'model') return fw.model ?? '';
    if (key === 'workspaceName') return fw.workspaceName;
    if (key === 'forticareDays') return fw.forticare.daysLeft;
    return '';
  }), [filteredFirewalls, fwSort.sortKey, fwSort.sortDir]);

  const sortedTls = useMemo(() => sortItems(filteredTls, tlsSort.sortKey, tlsSort.sortDir, (cert, key) => {
    if (key === 'ipPort') return `${cert.ip}:${cert.port}`;
    if (key === 'subjectCn') return cert.subjectCn;
    if (key === 'issuer') return cert.issuer;
    if (key === 'daysLeft') return cert.daysLeft;
    return '';
  }), [filteredTls, tlsSort.sortKey, tlsSort.sortDir]);

  const sortedDomains = useMemo(() => sortItems(filteredDomains, domSort.sortKey, domSort.sortDir, (d, key) => {
    if (key === 'domain') return d.domain;
    if (key === 'clientName') return d.clientName;
    if (key === 'registrar') return d.registrar ?? '';
    if (key === 'daysLeft') return d.daysLeft;
    return '';
  }), [filteredDomains, domSort.sortKey, domSort.sortDir]);

  const shouldHideM365 = (lic: { daysLeft: number | null; capabilityStatus: string }) =>
    lic.capabilityStatus === 'Suspended' ||
    (lic.daysLeft !== null && lic.daysLeft < -60);

  const { visibleM365, hiddenM365Count } = useMemo(() => {
    const visible = filteredM365.filter(lic => !shouldHideM365(lic));
    const hidden = filteredM365.filter(lic => shouldHideM365(lic));
    return { visibleM365: showOldExpired ? filteredM365 : visible, hiddenM365Count: hidden.length };
  }, [filteredM365, showOldExpired]);

  const sortedM365 = useMemo(() => sortItems(visibleM365, m365Sort.sortKey, m365Sort.sortDir, (lic, key) => {
    if (key === 'tenantDisplayName') return lic.tenantDisplayName;
    if (key === 'displayName') return lic.displayName;
    if (key === 'capabilityStatus') return lic.capabilityStatus;
    if (key === 'totalUnits') return lic.totalUnits;
    if (key === 'consumedUnits') return lic.consumedUnits;
    if (key === 'daysLeft') return lic.daysLeft;
    return '';
  }), [visibleM365, m365Sort.sortKey, m365Sort.sortDir]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Gestão de Ativos' }]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Ativos</h1>
            <p className="text-muted-foreground">Controle centralizado de ativos, licenças e certificados</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && workspaces && workspaces.length > 0 && (
              <Select value={selectedWorkspaceId || ''} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="w-[220px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Selecione o workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="gap-2"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['fortinet-eol'] })}
              disabled={loadingEol}
            >
              {loadingEol ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Atualizar Ciclo de Vida
            </Button>
          </div>
        </div>

        {/* Summary Cards (clickable filters) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            className={`cursor-pointer transition-all border-destructive/30 bg-destructive/5 ${activeFilter === 'expired' ? 'ring-2 ring-destructive' : 'hover:ring-1 hover:ring-destructive/50'}`}
            onClick={() => toggleFilter('expired')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{displaySummary.expired}</p>
                <p className="text-xs text-muted-foreground">Expirados</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all border-warning/30 bg-warning/5 ${activeFilter === 'expiring' ? 'ring-2 ring-warning' : 'hover:ring-1 hover:ring-warning/50'}`}
            onClick={() => toggleFilter('expiring')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{displaySummary.expiring}</p>
                <p className="text-xs text-muted-foreground">Expirando</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all border-emerald-500/30 bg-emerald-500/5 ${activeFilter === 'active' ? 'ring-2 ring-emerald-500' : 'hover:ring-1 hover:ring-emerald-500/50'}`}
            onClick={() => toggleFilter('active')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{displaySummary.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Key className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">{displaySummary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Filtro: {activeFilter === 'expired' ? 'Expirados' : activeFilter === 'expiring' ? 'Expirando' : 'Ativos'}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setActiveFilter(null)}>
              Limpar
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="firewalls" className="gap-2">
              <Shield className="w-4 h-4" /> Firewalls
            </TabsTrigger>
            <TabsTrigger value="tls" className="gap-2">
              <Globe className="w-4 h-4" /> Certificados TLS
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-2">
              <Globe className="w-4 h-4" /> Domínios Externos
            </TabsTrigger>
            <TabsTrigger value="m365" className="gap-2">
              <Cloud className="w-4 h-4" /> Microsoft 365
            </TabsTrigger>
          </TabsList>

          {/* Firewalls Tab */}
          <TabsContent value="firewalls">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFirewalls.length === 0 ? (
              <EmptyState message={activeFilter ? 'Nenhum firewall corresponde ao filtro selecionado' : 'Nenhum dado de licenciamento de firewall encontrado'} />
            ) : (
              <Card>
                <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Firewall" sortKey="firewallName" activeSortKey={fwSort.sortKey} sortDir={fwSort.sortDir} onSort={fwSort.handleSort} />
                      <SortableHead label="Modelo" sortKey="model" activeSortKey={fwSort.sortKey} sortDir={fwSort.sortDir} onSort={fwSort.handleSort} />
                      <SortableHead label="Workspace" sortKey="workspaceName" activeSortKey={fwSort.sortKey} sortDir={fwSort.sortDir} onSort={fwSort.handleSort} />
                      <SortableHead label="FortiCare" sortKey="forticareDays" activeSortKey={fwSort.sortKey} sortDir={fwSort.sortDir} onSort={fwSort.handleSort} />
                      <TableHead>Serviços FortiGuard</TableHead>
                      <TableHead>Ciclo de Vida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFirewalls.map(fw => (
                      <TableRow key={fw.firewallId}>
                        <TableCell className="font-medium">{fw.firewallName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{fw.model || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{fw.workspaceName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckStatusBadge status={fw.forticare.status} />
                            <ExpiryBadge daysLeft={fw.forticare.daysLeft} expiresAt={fw.forticare.expiresAt} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {groupServicesByExpiry(fw.services).map((group, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <ExpiryBadge daysLeft={group.daysLeft} expiresAt={group.expiresAt} />
                                <Tooltip>
                                  <TooltipTrigger className="text-xs text-muted-foreground cursor-default">
                                    {group.names.length} serviço{group.names.length !== 1 ? 's' : ''}
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="text-xs">{group.names.join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            ))}
                            {fw.services.length === 0 && (
                              <span className="text-xs text-muted-foreground">Sem serviços</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <EolBadges eol={fw.model && eolMap ? eolMap[fw.model] : (loadingEol ? undefined : null)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TLS Certificates Tab */}
          <TabsContent value="tls">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTls.length === 0 ? (
              <EmptyState message={activeFilter ? 'Nenhum certificado corresponde ao filtro selecionado' : 'Nenhum certificado TLS encontrado nos scans de superfície'} />
            ) : (
              <Card>
                <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="IP / Porta" sortKey="ipPort" activeSortKey={tlsSort.sortKey} sortDir={tlsSort.sortDir} onSort={tlsSort.handleSort} />
                      <SortableHead label="Subject CN" sortKey="subjectCn" activeSortKey={tlsSort.sortKey} sortDir={tlsSort.sortDir} onSort={tlsSort.handleSort} />
                      <SortableHead label="Issuer" sortKey="issuer" activeSortKey={tlsSort.sortKey} sortDir={tlsSort.sortDir} onSort={tlsSort.handleSort} />
                      <SortableHead label="Expiração" sortKey="daysLeft" activeSortKey={tlsSort.sortKey} sortDir={tlsSort.sortDir} onSort={tlsSort.handleSort} />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTls.map((cert, i) => (
                      <TableRow key={`${cert.ip}-${cert.port}-${i}`}>
                        <TableCell className="font-mono text-sm">{cert.ip}:{cert.port}</TableCell>
                        <TableCell className="font-medium">{cert.subjectCn}</TableCell>
                        <TableCell className="text-muted-foreground">{cert.issuer}</TableCell>
                        <TableCell className="text-sm">
                          {cert.expiresAt ? formatDate(cert.expiresAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <ExpiryBadge daysLeft={cert.daysLeft} expiresAt={cert.expiresAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* External Domains Tab */}
          <TabsContent value="domains">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDomains.length === 0 ? (
              <EmptyState message={activeFilter ? 'Nenhum domínio corresponde ao filtro selecionado' : 'Nenhum domínio externo cadastrado ou sem dados WHOIS coletados'} />
            ) : (
              <Card>
                <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Domínio" sortKey="domain" activeSortKey={domSort.sortKey} sortDir={domSort.sortDir} onSort={domSort.handleSort} />
                      <SortableHead label="Workspace" sortKey="clientName" activeSortKey={domSort.sortKey} sortDir={domSort.sortDir} onSort={domSort.handleSort} />
                      <SortableHead label="Registrar" sortKey="registrar" activeSortKey={domSort.sortKey} sortDir={domSort.sortDir} onSort={domSort.handleSort} />
                      <TableHead>Registro</TableHead>
                      <SortableHead label="Expiração" sortKey="daysLeft" activeSortKey={domSort.sortKey} sortDir={domSort.sortDir} onSort={domSort.handleSort} />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDomains.map(d => (
                      <TableRow key={d.domainId}>
                        <TableCell className="font-medium">{d.domain}</TableCell>
                        <TableCell className="text-muted-foreground">{d.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">{d.registrar || '—'}</TableCell>
                        <TableCell className="text-sm">{d.whoisCreatedAt ? formatDate(d.whoisCreatedAt) : '—'}</TableCell>
                        <TableCell className="text-sm">{d.expiresAt ? formatDate(d.expiresAt) : '—'}</TableCell>
                        <TableCell>
                          <ExpiryBadge daysLeft={d.daysLeft} expiresAt={d.expiresAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* M365 Tab */}
          <TabsContent value="m365">
            <div className="flex items-center justify-between mb-4">
              <div>
                {hiddenM365Count > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => setShowOldExpired(prev => !prev)}
                  >
                    {showOldExpired ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showOldExpired
                      ? 'Ocultar licenças suspensas/antigas'
                      : `${hiddenM365Count} licença(s) oculta(s) (suspensas ou expiradas há mais de 60 dias)`}
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshM365Licenses}
                disabled={refreshingM365}
              >
                {refreshingM365 ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Atualizar Licenças
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : visibleM365.length === 0 && hiddenM365Count === 0 ? (
              <EmptyState message={activeFilter ? 'Nenhuma licença corresponde ao filtro selecionado' : "Nenhuma licença M365 coletada. Clique em 'Atualizar Licenças' para buscar os dados do tenant."} />
            ) : (
              <>
                {visibleM365.length > 0 && (
                  <Card>
                    <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Licença</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Em uso</TableHead>
                          <TableHead>Vencimento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleM365.map((lic, i) => (
                          <TableRow key={`${lic.skuPartNumber}-${i}`} className={lic.daysLeft !== null && lic.daysLeft < -60 ? 'opacity-50' : ''}>
                            <TableCell className="text-muted-foreground">{lic.tenantDisplayName}</TableCell>
                            <TableCell className="font-medium">{lic.displayName}</TableCell>
                            <TableCell>
                              <Badge variant={lic.capabilityStatus === 'Enabled' ? 'default' : 'destructive'} className={
                                lic.capabilityStatus === 'Enabled'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : ''
                              }>
                                {lic.capabilityStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{lic.totalUnits.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{lic.consumedUnits.toLocaleString()}</TableCell>
                            <TableCell>
                              {lic.expiresAt ? (
                                <ExpiryBadge daysLeft={lic.daysLeft} expiresAt={lic.expiresAt} />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Key className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
