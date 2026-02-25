import { AppLayout } from '@/components/layout/AppLayout';
import { useLicensingHub, getLicenseStatus, LicenseStatus } from '@/hooks/useLicensingHub';
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
import { Key, Shield, Globe, Cloud, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const StatusBadge = ({ daysLeft }: { daysLeft: number | null }) => {
  const status = getLicenseStatus(daysLeft);
  if (status === 'expired') {
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Expirado</Badge>;
  }
  if (status === 'expiring') {
    return <Badge className="bg-warning/20 text-warning border-warning/30">{daysLeft}d restantes</Badge>;
  }
  if (status === 'active') {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
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

export default function LicensingHubPage() {
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    isSuperRole,
    firewallLicenses,
    tlsCertificates,
    m365Licenses,
    summary,
    loading,
    refreshM365Licenses,
    refreshingM365,
  } = useLicensingHub();

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
              <h1 className="text-2xl font-bold text-foreground">HUB de Licenciamento</h1>
              <p className="text-sm text-muted-foreground">Controle centralizado de licenças e certificados</p>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{summary.expired}</p>
                <p className="text-xs text-muted-foreground">Expirados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{summary.expiring}</p>
                <p className="text-xs text-muted-foreground">Expirando</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{summary.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Key className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="firewalls" className="space-y-4">
          <TabsList>
            <TabsTrigger value="firewalls" className="gap-2">
              <Shield className="w-4 h-4" /> Firewalls
            </TabsTrigger>
            <TabsTrigger value="tls" className="gap-2">
              <Globe className="w-4 h-4" /> Certificados TLS
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
            ) : firewallLicenses.length === 0 ? (
              <EmptyState message="Nenhum dado de licenciamento de firewall encontrado" />
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Firewall</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>FortiCare</TableHead>
                      <TableHead>Serviços FortiGuard</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firewallLicenses.map(fw => (
                      <TableRow key={fw.firewallId}>
                        <TableCell className="font-medium">{fw.firewallName}</TableCell>
                        <TableCell className="text-muted-foreground">{fw.workspaceName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckStatusBadge status={fw.forticare.status} />
                            <StatusBadge daysLeft={fw.forticare.daysLeft} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {fw.services.map((svc, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">{svc.name}:</span>
                                <StatusBadge daysLeft={svc.daysLeft} />
                              </div>
                            ))}
                            {fw.services.length === 0 && (
                              <span className="text-xs text-muted-foreground">Sem serviços</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* TLS Certificates Tab */}
          <TabsContent value="tls">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tlsCertificates.length === 0 ? (
              <EmptyState message="Nenhum certificado TLS encontrado nos scans de superfície" />
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
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
                    {tlsCertificates.map((cert, i) => (
                      <TableRow key={`${cert.ip}-${cert.port}-${i}`}>
                        <TableCell className="font-mono text-sm">{cert.ip}:{cert.port}</TableCell>
                        <TableCell className="font-medium">{cert.subjectCn}</TableCell>
                        <TableCell className="text-muted-foreground">{cert.issuer}</TableCell>
                        <TableCell className="text-sm">
                          {cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge daysLeft={cert.daysLeft} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* M365 Tab */}
          <TabsContent value="m365">
            <div className="flex justify-end mb-4">
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
            ) : m365Licenses.length === 0 ? (
              <EmptyState message="Nenhuma licença M365 coletada. Clique em 'Atualizar Licenças' para buscar os dados do tenant." />
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
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
                    {m365Licenses.map((lic, i) => (
                      <TableRow key={`${lic.skuPartNumber}-${i}`}>
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
                            <StatusBadge daysLeft={lic.daysLeft} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
