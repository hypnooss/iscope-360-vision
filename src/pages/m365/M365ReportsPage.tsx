import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Eye, Loader2, AlertTriangle, CheckCircle, Filter, Cloud } from 'lucide-react';
import { toast } from 'sonner';

interface PostureReport {
  id: string;
  tenant_record_id: string;
  client_id: string;
  score: number | null;
  classification: string | null;
  created_at: string;
}

interface Tenant {
  id: string;
  tenant_domain: string | null;
  display_name: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface GroupedTenant {
  tenant_record_id: string;
  tenant_name: string;
  tenant_domain: string | null;
  client_id: string;
  client_name: string;
  analyses: {
    id: string;
    score: number | null;
    classification: string | null;
    created_at: string;
  }[];
}

export default function M365ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();
  const { isPreviewMode, previewTarget } = usePreview();
  const navigate = useNavigate();

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [selectedAnalyses, setSelectedAnalyses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading || moduleLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  // Fetch reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['m365-posture-reports', isPreviewMode, previewTarget?.workspaces],
    queryFn: async () => {
      const workspaceIds = isPreviewMode && previewTarget?.workspaces
        ? previewTarget.workspaces.map(w => w.id)
        : null;

      let query = supabase
        .from('m365_posture_history')
        .select('id, tenant_record_id, client_id, score, classification, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (workspaceIds && workspaceIds.length > 0) {
        query = query.in('client_id', workspaceIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PostureReport[];
    },
    enabled: !!user,
  });

  // Fetch tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ['m365-tenants-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m365_tenants')
        .select('id, tenant_domain, display_name');
      if (error) throw error;
      return (data || []) as Tenant[];
    },
    enabled: !!user,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name');
      if (error) throw error;
      return (data || []) as Client[];
    },
    enabled: !!user,
  });

  // Create lookup maps
  const tenantMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  // Filter reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesClient = selectedClient === 'all' || r.client_id === selectedClient;
      const matchesTenant = selectedTenant === 'all' || r.tenant_record_id === selectedTenant;
      return matchesClient && matchesTenant;
    });
  }, [reports, selectedClient, selectedTenant]);

  // Group by tenant
  const groupedTenants = useMemo(() => {
    const groups = new Map<string, GroupedTenant>();

    filteredReports.forEach(report => {
      if (!groups.has(report.tenant_record_id)) {
        const tenant = tenantMap.get(report.tenant_record_id);
        const client = clientMap.get(report.client_id);
        groups.set(report.tenant_record_id, {
          tenant_record_id: report.tenant_record_id,
          tenant_name: tenant?.display_name || tenant?.tenant_domain || 'N/A',
          tenant_domain: tenant?.tenant_domain || null,
          client_id: report.client_id,
          client_name: client?.name || 'N/A',
          analyses: [],
        });
      }

      groups.get(report.tenant_record_id)!.analyses.push({
        id: report.id,
        score: report.score,
        classification: report.classification,
        created_at: report.created_at,
      });
    });

    // Sort analyses by date
    groups.forEach(group => {
      group.analyses.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return Array.from(groups.values());
  }, [filteredReports, tenantMap, clientMap]);

  // Initialize selected analyses
  useEffect(() => {
    const initial: Record<string, string> = {};
    groupedTenants.forEach(group => {
      if (group.analyses.length > 0 && !selectedAnalyses[group.tenant_record_id]) {
        initial[group.tenant_record_id] = group.analyses[0].id;
      }
    });
    if (Object.keys(initial).length > 0) {
      setSelectedAnalyses(prev => ({ ...prev, ...initial }));
    }
  }, [groupedTenants]);

  // Available tenants for filter
  const availableTenants = useMemo(() => {
    if (selectedClient === 'all') {
      return [...new Set(reports.map(r => r.tenant_record_id))].map(id => ({
        id,
        name: tenantMap.get(id)?.display_name || tenantMap.get(id)?.tenant_domain || id,
      }));
    }
    return [...new Set(reports.filter(r => r.client_id === selectedClient).map(r => r.tenant_record_id))].map(id => ({
      id,
      name: tenantMap.get(id)?.display_name || tenantMap.get(id)?.tenant_domain || id,
    }));
  }, [reports, selectedClient, tenantMap]);

  // Available clients for filter
  const availableClients = useMemo(() => {
    return [...new Set(reports.map(r => r.client_id))].map(id => ({
      id,
      name: clientMap.get(id)?.name || id,
    }));
  }, [reports, clientMap]);

  const getSelectedAnalysis = (group: GroupedTenant) => {
    const selectedId = selectedAnalyses[group.tenant_record_id];
    return group.analyses.find(a => a.id === selectedId) || group.analyses[0];
  };

  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const handleViewReport = async (group: GroupedTenant) => {
    const analysis = getSelectedAnalysis(group);
    if (!analysis) return;

    setLoadingReportId(analysis.id);
    try {
      navigate(`/scope-m365/compliance/report/${analysis.id}`, {
        state: {
          tenantMeta: {
            tenant_record_id: group.tenant_record_id,
            tenant_name: group.tenant_name,
            tenant_domain: group.tenant_domain,
            client_name: group.client_name,
          },
        },
      });
    } finally {
      setLoadingReportId(null);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 90) return 'bg-green-500/10 text-green-500';
    if (score >= 70) return 'bg-green-500/10 text-green-500';
    if (score >= 50) return 'bg-yellow-500/10 text-yellow-500';
    return 'bg-red-500/10 text-red-500';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || moduleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Relatórios' },
        ]} />

        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Histórico de análises de postura de segurança</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          {availableClients.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os workspaces</SelectItem>
                  {availableClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            {availableClients.length <= 1 && <Filter className="w-4 h-4 text-muted-foreground" />}
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                {availableTenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reports Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Histórico de Análises
            </CardTitle>
            <CardDescription>
              {groupedTenants.length} tenant(s) com {filteredReports.length} análise(s) no total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : groupedTenants.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{reports.length === 0 ? 'Nenhum relatório disponível' : 'Nenhum relatório encontrado com os filtros'}</p>
                {reports.length === 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/scope-m365/analysis')}
                  >
                    Iniciar Análise
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTenants.map(group => {
                    const currentAnalysis = getSelectedAnalysis(group);
                    return (
                      <TableRow key={group.tenant_record_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-medium">{group.tenant_name}</p>
                              {group.tenant_domain && group.tenant_domain !== group.tenant_name && (
                                <p className="text-xs text-muted-foreground">{group.tenant_domain}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {group.analyses.length} análise(s)
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{group.client_name}</TableCell>
                        <TableCell>
                          {currentAnalysis && (
                            <Badge className={getScoreColor(currentAnalysis.score)}>
                              <span className="flex items-center gap-1">
                                {currentAnalysis.score !== null && currentAnalysis.score >= 70 ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {currentAnalysis.score !== null ? `${currentAnalysis.score}%` : 'N/A'}
                              </span>
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selectedAnalyses[group.tenant_record_id] || group.analyses[0]?.id}
                            onValueChange={(value) => setSelectedAnalyses(prev => ({
                              ...prev,
                              [group.tenant_record_id]: value,
                            }))}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {group.analyses.map(analysis => (
                                <SelectItem key={analysis.id} value={analysis.id}>
                                  {formatDate(analysis.created_at)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewReport(group)}
                            disabled={loadingReportId === currentAnalysis?.id}
                          >
                            {loadingReportId === currentAnalysis?.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
