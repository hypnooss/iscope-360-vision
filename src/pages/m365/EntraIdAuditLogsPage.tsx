import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useTenantConnection } from '@/hooks/useTenantConnection';
import { useEntraIdAuditLogs, LogType, AuditLogFilters, SignInLog, DirectoryAuditLog } from '@/hooks/useEntraIdAuditLogs';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  RefreshCw, 
  Search, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  FileText,
  LogIn,
  Shield
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EntraIdAuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, loading: tenantsLoading, hasConnectedTenant } = useTenantConnection();
  
  const [logType, setLogType] = useState<LogType>('signIns');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    dateFrom: startOfDay(subDays(new Date(), 7)),
    dateTo: endOfDay(new Date()),
  });
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | 'custom'>('7d');

  const { 
    logs, 
    loading: logsLoading, 
    error, 
    errorCode,
    hasMore, 
    loadMore, 
    refresh,
    fetchLogs 
  } = useEntraIdAuditLogs({
    tenantRecordId: selectedTenantId,
    logType,
    filters,
  });

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, hasModuleAccess, navigate]);

  // Select first connected tenant
  useEffect(() => {
    if (!tenantsLoading && tenants.length > 0 && !selectedTenantId) {
      const connectedTenant = tenants.find(
        t => t.connection_status === 'connected' || t.connection_status === 'partial'
      );
      if (connectedTenant) {
        setSelectedTenantId(connectedTenant.id);
      }
    }
  }, [tenants, tenantsLoading, selectedTenantId]);

  // Fetch logs when tenant or filters change
  useEffect(() => {
    if (selectedTenantId) {
      fetchLogs();
    }
  }, [selectedTenantId, logType, filters, fetchLogs]);

  // Handle date range change
  const handleDateRangeChange = useCallback((range: '7d' | '14d' | '30d' | 'custom') => {
    setDateRange(range);
    if (range !== 'custom') {
      const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
      setFilters(prev => ({
        ...prev,
        dateFrom: startOfDay(subDays(new Date(), days)),
        dateTo: endOfDay(new Date()),
      }));
    }
  }, []);

  // Apply user filter
  const handleUserFilterApply = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      user: userFilter || undefined,
    }));
  }, [userFilter]);

  // Apply status filter
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value as 'all' | 'success' | 'failure');
    setFilters(prev => ({
      ...prev,
      status: value === 'all' ? undefined : (value as 'success' | 'failure'),
    }));
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setLogType(value as LogType);
  }, []);

  if (authLoading) return null;

  const connectedTenants = tenants.filter(
    t => t.connection_status === 'connected' || t.connection_status === 'partial'
  );

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatLocation = (location: SignInLog['location']) => {
    if (!location) return '-';
    const parts = [location.city, location.state, location.countryOrRegion].filter(Boolean);
    return parts.join(', ') || '-';
  };

  const getStatusBadge = (errorCode: number) => {
    if (errorCode === 0) {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
          <CheckCircle className="w-3 h-3" />
          Sucesso
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20 gap-1">
        <XCircle className="w-3 h-3" />
        Falha
      </Badge>
    );
  };

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
          <CheckCircle className="w-3 h-3" />
          Sucesso
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
        <AlertTriangle className="w-3 h-3" />
        {result}
      </Badge>
    );
  };

  const getInitiatedBy = (initiatedBy: DirectoryAuditLog['initiatedBy'] | undefined) => {
    if (!initiatedBy) return '-';
    if (initiatedBy.user?.displayName) {
      return initiatedBy.user.displayName;
    }
    if (initiatedBy.app?.displayName) {
      return `App: ${initiatedBy.app.displayName}`;
    }
    return '-';
  };

  const getTargetResources = (targets: DirectoryAuditLog['targetResources']) => {
    if (!targets || targets.length === 0) return '-';
    return targets.map(t => t.displayName || t.type).join(', ');
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365' },
          { label: 'Entra ID', href: '/scope-m365/entra-id' },
          { label: 'Logs de Auditoria' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
            <p className="text-muted-foreground">
              Visualize eventos de sign-in e alterações no diretório
            </p>
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={refresh}
            disabled={logsLoading}
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Tenant Selector (if multiple) */}
        {connectedTenants.length > 1 && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Tenant:</span>
                <Select 
                  value={selectedTenantId || ''} 
                  onValueChange={setSelectedTenantId}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecione um tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedTenants.map(tenant => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.display_name || tenant.tenant_domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Select value={dateRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="14d">Últimos 14 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Filtrar por usuário (UPN)"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-64"
                  onKeyDown={(e) => e.key === 'Enter' && handleUserFilterApply()}
                />
                <Button variant="secondary" size="icon" onClick={handleUserFilterApply}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              {/* Status Filter (only for signIns) */}
              {logType === 'signIns' && (
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="failure">Falha</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={logType} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="signIns" className="gap-2">
              <LogIn className="w-4 h-4" />
              Sign-In Logs
            </TabsTrigger>
            <TabsTrigger value="directoryAudits" className="gap-2">
              <FileText className="w-4 h-4" />
              Directory Audits
            </TabsTrigger>
          </TabsList>

          {/* Error State */}
          {error && (
            <Card className="border-red-500/30 bg-red-500/5 mb-4">
              <CardContent className="py-6 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">
                  {errorCode === 'PREMIUM_LICENSE_REQUIRED' 
                    ? 'Licença Premium Necessária' 
                    : 'Erro ao carregar logs'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {error}
                </p>
                {errorCode === 'PREMIUM_LICENSE_REQUIRED' && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg max-w-lg mx-auto">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="w-4 h-4" />
                      <span>
                        Os logs de auditoria do Entra ID requerem uma licença Azure AD Premium P1 ou P2.
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {logsLoading && logs.length === 0 && (
            <Card>
              <CardContent className="py-6">
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sign-In Logs Table */}
          <TabsContent value="signIns">
            {!error && !logsLoading && logs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <LogIn className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum log encontrado</h3>
                  <p className="text-muted-foreground">
                    Não há logs de sign-in para o período selecionado.
                  </p>
                </CardContent>
              </Card>
            )}

            {logs.length > 0 && logType === 'signIns' && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Aplicativo</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cliente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(logs as SignInLog[]).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(log.createdDateTime)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.userDisplayName || '-'}</div>
                              <div className="text-xs text-muted-foreground">{log.userPrincipalName}</div>
                            </div>
                          </TableCell>
                          <TableCell>{log.appDisplayName || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                          <TableCell>{formatLocation(log.location)}</TableCell>
                          <TableCell>{getStatusBadge(log.status?.errorCode)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {log.deviceDetail?.browser || '-'}
                              {log.deviceDetail?.operatingSystem && (
                                <div className="text-xs text-muted-foreground">
                                  {log.deviceDetail.operatingSystem}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Directory Audits Table */}
          <TabsContent value="directoryAudits">
            {!error && !logsLoading && logs.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum log encontrado</h3>
                  <p className="text-muted-foreground">
                    Não há logs de auditoria para o período selecionado.
                  </p>
                </CardContent>
              </Card>
            )}

            {logs.length > 0 && logType === 'directoryAudits' && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Iniciado por</TableHead>
                        <TableHead>Alvo</TableHead>
                        <TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(logs as DirectoryAuditLog[]).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(log.activityDateTime)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{log.activityDisplayName}</div>
                            <div className="text-xs text-muted-foreground">{log.operationType}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.category}</Badge>
                          </TableCell>
                          <TableCell>{getInitiatedBy(log.initiatedBy)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {getTargetResources(log.targetResources)}
                          </TableCell>
                          <TableCell>{getResultBadge(log.result)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button 
              variant="outline" 
              onClick={loadMore} 
              disabled={logsLoading}
              className="gap-2"
            >
              {logsLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Carregar mais
            </Button>
          </div>
        )}

        {/* Results count */}
        {logs.length > 0 && (
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Exibindo {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
            {hasMore && ' (há mais registros disponíveis)'}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
