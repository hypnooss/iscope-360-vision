import { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { usePreview } from '@/contexts/PreviewContext';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { TenantSelector } from '@/components/m365/posture/TenantSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  HeartPulse, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Info,
  Clock, Building2, X, ExternalLink, Download, Wifi, WifiOff, Activity,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateTimeBR } from '@/lib/dateUtils';

// ====== Types ======

interface ServiceHealth {
  id: string;
  service: string;
  status: string;
}

interface ServiceIssue {
  id: string;
  title: string;
  service: string;
  status: string;
  classification: string;
  origin: string;
  startDateTime: string;
  endDateTime: string | null;
  lastModifiedDateTime: string;
  isResolved: boolean;
  impactDescription: string;
  featureGroup: string | null;
  feature: string | null;
  posts: Array<{ createdDateTime: string; content: string; contentType: string }>;
}

// ====== Constants ======

const BAR_COLORS = [
  'hsl(175, 80%, 45%)',
  'hsl(220, 70%, 55%)',
  'hsl(35, 90%, 55%)',
  'hsl(0, 70%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(45, 80%, 50%)',
  'hsl(340, 60%, 55%)',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string; icon: typeof CheckCircle2 }> = {
  serviceOperational: { label: 'Operacional', color: 'text-emerald-400', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  investigating: { label: 'Investigando', color: 'text-amber-400', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  restoringService: { label: 'Restaurando', color: 'text-amber-400', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: RefreshCw },
  serviceDegradation: { label: 'Degradação', color: 'text-orange-400', badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertTriangle },
  serviceInterruption: { label: 'Interrupção', color: 'text-red-400', badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30', icon: XCircle },
  extendedRecovery: { label: 'Recuperação', color: 'text-orange-400', badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: Clock },
  falsePositive: { label: 'Falso Positivo', color: 'text-muted-foreground', badgeClass: 'bg-muted text-muted-foreground border-border', icon: Info },
  postIncidentReviewPublished: { label: 'Revisão Publicada', color: 'text-blue-400', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Info },
  serviceRestored: { label: 'Restaurado', color: 'text-emerald-400', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  advisory: 'Aviso',
  incident: 'Incidente',
};

// ====== Component ======

function M365ServiceHealthPage() {
  const { user } = useAuth();
  const { effectiveRole } = useEffectiveAuth();
  const { isPreviewMode } = usePreview();

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);
  const { tenants, selectedTenantId, selectedTenant, selectTenant, loading: tenantLoading } = useM365TenantSelector(
    isSuperRole ? selectedWorkspaceId : undefined
  );
  const [selectedIssue, setSelectedIssue] = useState<ServiceIssue | null>(null);
  const [filter, setFilter] = useState<{ type: string; value: string } | null>(null);

  const toggleFilter = (type: string, value: string) => {
    setFilter(prev => (prev?.type === type && prev?.value === value) ? null : { type, value });
  };

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['m365-service-health', selectedTenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('m365-service-health', {
        body: { tenant_record_id: selectedTenantId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      return data as { services: ServiceHealth[]; issues: ServiceIssue[] };
    },
    enabled: !!selectedTenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const services = data?.services || [];
  const issues = data?.issues || [];

  // ====== Computed Data ======

  const healthyCount = services.filter(s => s.status === 'serviceOperational').length;
  const degradedCount = services.length - healthyCount;

  const activeIncidentsByService = useMemo(() => {
    const nonOpServices = services.filter(s => s.status !== 'serviceOperational');
    return nonOpServices.map(s => {
      const serviceIssues = issues.filter(i => i.service === s.service && !i.isResolved);
      return { ...s, issues: serviceIssues };
    });
  }, [services, issues]);

  const serviceChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach(i => { counts[i.service] = (counts[i.service] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, eventos]) => ({ name, eventos }));
  }, [issues]);

  const timelineData = useMemo(() => {
    const months: Record<string, number> = {};
    issues.forEach(i => {
      if (!i.startDateTime) return;
      const d = parseISO(i.startDateTime);
      const key = format(d, 'MMM/yy', { locale: ptBR });
      months[key] = (months[key] || 0) + 1;
    });
    return Object.entries(months)
      .slice(-12)
      .map(([name, eventos]) => ({ name, eventos }));
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (!filter) return issues;
    switch (filter.type) {
      case 'status':
        return issues.filter(i => (STATUS_CONFIG[i.status]?.label || i.status) === filter.value);
      case 'service':
        return issues.filter(i => i.service === filter.value);
      case 'card':
        if (filter.value === 'degraded') {
          const degradedServices = new Set(services.filter(s => s.status !== 'serviceOperational').map(s => s.service));
          return issues.filter(i => degradedServices.has(i.service));
        }
        return issues;
      default:
        return issues;
    }
  }, [issues, services, filter]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return formatDateTimeBR(d);
  };

  const lastUpdatedLabel = dataUpdatedAt
    ? formatDateTimeBR(new Date(dataUpdatedAt))
    : null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/compliance' },
          { label: 'Saúde do 365' },
        ]} />

        {/* ===== SEÇÃO 1: Contexto do Tenant ===== */}
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-primary" />
                  <h1 className="text-lg font-bold text-foreground">Saúde do Microsoft 365</h1>
                </div>

                {isSuperRole && allWorkspaces && (
                  <Select value={selectedWorkspaceId || ''} onValueChange={setSelectedWorkspaceId}>
                    <SelectTrigger className="w-[200px] h-9">
                      <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {allWorkspaces.map(w => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <TenantSelector
                  tenants={tenants}
                  selectedId={selectedTenantId}
                  onSelect={selectTenant}
                  loading={tenantLoading}
                />

                {selectedTenantId && data && (
                  <>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5">
                      <Wifi className="w-3 h-3" />
                      Conectado
                    </Badge>
                    {lastUpdatedLabel && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {lastUpdatedLabel}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching || !selectedTenantId}
                >
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span className="ml-1.5 hidden sm:inline">Atualizar</span>
                </Button>
                <Button variant="outline" size="sm" disabled={!data}>
                  <Download className="w-4 h-4" />
                  <span className="ml-1.5 hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href="https://admin.microsoft.com/Adminportal/Home#/servicehealth"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="ml-1.5 hidden sm:inline">Service Health</span>
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty state */}
        {!selectedTenantId && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Selecione um tenant para visualizar a saúde dos serviços.</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {selectedTenantId && isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-border/50"><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {selectedTenantId && !isLoading && data && (
          <>
            {/* ===== SEÇÃO 2: Status da Plataforma ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card
                className={`border-border/50 bg-card/80 cursor-pointer transition-all hover:border-primary/40 ${filter?.type === 'card' && filter.value === 'operational' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => toggleFilter('card', 'operational')}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{healthyCount}</p>
                    <p className="text-sm text-muted-foreground">Serviços Operacionais</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`border-border/50 bg-card/80 cursor-pointer transition-all hover:border-primary/40 ${filter?.type === 'card' && filter.value === 'degraded' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => toggleFilter('card', 'degraded')}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${degradedCount > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
                    <AlertTriangle className={`w-7 h-7 ${degradedCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{degradedCount}</p>
                    <p className="text-sm text-muted-foreground">Com Problemas</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`border-border/50 bg-card/80 cursor-pointer transition-all hover:border-primary/40 ${!filter ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setFilter(null)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <Activity className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{issues.length}</p>
                    <p className="text-sm text-muted-foreground">Eventos Ativos</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== SEÇÃO 3: Incidentes Ativos ===== */}
            {activeIncidentsByService.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Incidentes Ativos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeIncidentsByService.map(svc => {
                    const sc = STATUS_CONFIG[svc.status];
                    const StatusIcon = sc?.icon || AlertTriangle;
                    return (
                      <Card key={svc.id} className="border-border/50 bg-card/80">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground text-sm">{svc.service}</span>
                            <Badge variant="outline" className={sc?.badgeClass || 'bg-muted text-muted-foreground border-border'}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {sc?.label || svc.status}
                            </Badge>
                          </div>
                          {svc.issues.length > 0 ? (
                            <div className="space-y-1.5">
                              {svc.issues.slice(0, 3).map(issue => (
                                <button
                                  key={issue.id}
                                  onClick={() => setSelectedIssue(issue)}
                                  className="w-full text-left rounded-lg border border-border/30 bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors"
                                >
                                  <p className="text-xs text-foreground/90 line-clamp-1">{issue.title}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {CLASSIFICATION_LABELS[issue.classification] || issue.classification} · {formatDate(issue.startDateTime)}
                                  </p>
                                </button>
                              ))}
                              {svc.issues.length > 3 && (
                                <p className="text-[10px] text-muted-foreground text-center">
                                  +{svc.issues.length - 3} evento(s)
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem incidentes abertos</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== SEÇÕES 4+5: Serviços Afetados + Histórico ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Seção 4: Serviços Afetados - Barras Horizontais */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">Serviços Afetados</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  {serviceChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceChartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          width={120}
                        />
                        <ReTooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        <Bar
                          dataKey="eventos"
                          radius={[0, 4, 4, 0]}
                          cursor="pointer"
                          onClick={(entry: any) => toggleFilter('service', entry.name)}
                        >
                          {serviceChartData.map((_, i) => (
                            <Cell key={`bar-${i}`} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Nenhum serviço afetado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seção 5: Histórico de Eventos */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">Histórico de Eventos</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  {timelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                        <ReTooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="eventos"
                          stroke="hsl(175, 80%, 45%)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: 'hsl(175, 80%, 45%)' }}
                          activeDot={{ r: 5, stroke: 'hsl(175, 80%, 45%)', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      Sem dados de histórico
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== SEÇÃO 6: Lista de Incidentes ===== */}
            <Card className="border-border/50 bg-card/80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Incidentes e Avisos ({filteredIssues.length}{filter ? ` de ${issues.length}` : ''})
                  </CardTitle>
                  {filter && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        Filtro: {filter.value}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setFilter(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead className="hidden lg:table-cell">Título</TableHead>
                      <TableHead>Atualização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resolvido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIssues.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          Nenhum evento encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredIssues.map(issue => {
                      const sc = STATUS_CONFIG[issue.status];
                      const StatusIcon = sc?.icon || Info;
                      return (
                        <TableRow
                          key={issue.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedIssue(issue)}
                        >
                          <TableCell className="text-xs whitespace-nowrap">{formatDate(issue.startDateTime)}</TableCell>
                          <TableCell className="text-xs font-medium">{issue.service}</TableCell>
                          <TableCell>
                            <Badge variant={issue.classification === 'incident' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {CLASSIFICATION_LABELS[issue.classification] || issue.classification}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{issue.id}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs max-w-[300px] truncate">{issue.title}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{formatDate(issue.lastModifiedDateTime)}</TableCell>
                          <TableCell>
                            <span className={`flex items-center gap-1.5 text-xs ${sc?.color || 'text-muted-foreground'}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {sc?.label || issue.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {issue.isResolved
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              : <XCircle className="w-4 h-4 text-muted-foreground/40" />
                            }
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedIssue && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base leading-snug">{selectedIssue.title}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedIssue.classification === 'incident' ? 'destructive' : 'secondary'}>
                    {CLASSIFICATION_LABELS[selectedIssue.classification] || selectedIssue.classification}
                  </Badge>
                  <span className="font-mono text-xs">{selectedIssue.id}</span>
                  <span className="text-xs">{selectedIssue.service}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Início</p>
                    <p className="font-medium text-foreground">{formatDate(selectedIssue.startDateTime)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Última Atualização</p>
                    <p className="font-medium text-foreground">{formatDate(selectedIssue.lastModifiedDateTime)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className={`font-medium ${STATUS_CONFIG[selectedIssue.status]?.color || ''}`}>
                      {STATUS_CONFIG[selectedIssue.status]?.label || selectedIssue.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Resolvido</p>
                    <p className="font-medium text-foreground">{selectedIssue.isResolved ? 'Sim' : 'Não'}</p>
                  </div>
                  {selectedIssue.featureGroup && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Feature</p>
                      <p className="font-medium text-foreground">{selectedIssue.featureGroup}{selectedIssue.feature ? ` / ${selectedIssue.feature}` : ''}</p>
                    </div>
                  )}
                </div>

                {selectedIssue.impactDescription && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Impacto</p>
                    <p className="text-sm text-foreground leading-relaxed">{selectedIssue.impactDescription}</p>
                  </div>
                )}

                {selectedIssue.posts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Atualizações ({selectedIssue.posts.length})</p>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {selectedIssue.posts.map((post, i) => (
                        <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                          <p className="text-[10px] text-muted-foreground mb-1">{formatDate(post.createdDateTime)}</p>
                          {post.contentType === 'html' ? (
                            <div
                              className="text-xs text-foreground/90 leading-relaxed prose prose-invert prose-xs max-w-none [&_a]:text-primary [&_a]:underline"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
                            />
                          ) : (
                            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

export default M365ServiceHealthPage;
