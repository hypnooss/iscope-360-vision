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
import { Key, Shield, Globe, Cloud, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, Info } from 'lucide-react';

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

  const shouldHideM365 = (lic: { daysLeft: number | null; capabilityStatus: string }) =>
    lic.capabilityStatus === 'Suspended' ||
    (lic.daysLeft !== null && lic.daysLeft < -60);

  const { visibleM365, hiddenM365Count } = useMemo(() => {
    const visible = filteredM365.filter(lic => !shouldHideM365(lic));
    const hidden = filteredM365.filter(lic => shouldHideM365(lic));
    return { visibleM365: showOldExpired ? filteredM365 : visible, hiddenM365Count: hidden.length };
  }, [filteredM365, showOldExpired]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestão de Ativos</h1>
              <p className="text-sm text-muted-foreground">Controle centralizado de ativos, licenças e certificados</p>
            </div>
          </div>

          {isSuperRole && workspaces && workspaces.length > 0 && (
            <Select value={selectedWorkspaceId || ''} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecionar workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
            <div className="flex items-center justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['fortinet-eol'] })}
                disabled={loadingEol}
              >
                {loadingEol ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Atualizar Ciclo de Vida
              </Button>
            </div>
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
                      <TableHead>Firewall</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>FortiCare</TableHead>
                      <TableHead>Serviços FortiGuard</TableHead>
                      <TableHead>Ciclo de Vida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFirewalls.map(fw => (
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
                      <TableHead>IP / Porta</TableHead>
                      <TableHead>Subject CN</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTls.map((cert, i) => (
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
                      <TableHead>Domínio</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Registrar</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDomains.map(d => (
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
