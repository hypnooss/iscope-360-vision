import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { M365ScoreGauge, M365CategoryCard, M365InsightCard, M365SeverityBreakdown } from '@/components/m365/posture';
import { Loader2, ArrowLeft, Calendar, Building, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PostureData {
  id: string;
  score: number;
  classification: string;
  summary: any;
  category_breakdown: any[];
  insights: any[];
  created_at: string;
  tenant_record_id: string;
  client_id: string;
}

export default function M365PostureReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const tenantMeta = location.state?.tenantMeta;

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

  // Fetch report data
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['m365-posture-report', reportId],
    queryFn: async () => {
      if (!reportId) throw new Error('Report ID is required');

      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('id, score, classification, summary, category_breakdown, insights, created_at, tenant_record_id, client_id')
        .eq('id', reportId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Report not found');

      return data as PostureData;
    },
    enabled: !!reportId && !!user,
  });

  // Fetch tenant and client info if not passed via state
  const { data: tenantInfo } = useQuery({
    queryKey: ['m365-tenant-info', reportData?.tenant_record_id],
    queryFn: async () => {
      if (!reportData?.tenant_record_id) return null;

      const { data: tenant } = await supabase
        .from('m365_tenants')
        .select('display_name, tenant_domain')
        .eq('id', reportData.tenant_record_id)
        .maybeSingle();

      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', reportData.client_id)
        .maybeSingle();

      return {
        tenant_name: tenant?.display_name || tenant?.tenant_domain || 'N/A',
        tenant_domain: tenant?.tenant_domain,
        client_name: client?.name || 'N/A',
      };
    },
    enabled: !!reportData && !tenantMeta,
  });

  const displayInfo = tenantMeta || tenantInfo || {};

  // Memoize categories and insights
  const categories = useMemo(() => {
    return reportData?.category_breakdown || [];
  }, [reportData]);

  const insights = useMemo(() => {
    return reportData?.insights || [];
  }, [reportData]);

  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return insights;
    return insights.filter((i: any) => i.category === selectedCategory);
  }, [insights, selectedCategory]);

  const failedInsights = useMemo(() => {
    return filteredInsights.filter((i: any) => i.status === 'fail');
  }, [filteredInsights]);

  const passedInsights = useMemo(() => {
    return filteredInsights.filter((i: any) => i.status === 'pass');
  }, [filteredInsights]);

  if (authLoading || moduleLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !reportData) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Relatório não encontrado</h2>
            <p className="text-muted-foreground mb-4">O relatório solicitado não existe ou você não tem permissão.</p>
            <Button onClick={() => navigate('/scope-m365/reports')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Relatórios
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
          { label: 'Relatórios', href: '/scope-m365/reports' },
          { label: displayInfo.tenant_name || 'Relatório' },
        ]} />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" onClick={() => navigate('/scope-m365/reports')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-bold">{displayInfo.tenant_name || 'Relatório de Postura'}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {displayInfo.tenant_domain && (
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  {displayInfo.tenant_domain}
                </span>
              )}
              {displayInfo.client_name && (
                <span className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {displayInfo.client_name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(reportData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="glass-card lg:col-span-1">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <M365ScoreGauge score={reportData.score} classification={reportData.classification as any} size="lg" />
              <Badge
                className={
                  reportData.classification === 'excellent' ? 'bg-green-500/10 text-green-500 mt-4' :
                  reportData.classification === 'good' ? 'bg-green-500/10 text-green-500 mt-4' :
                  reportData.classification === 'attention' ? 'bg-yellow-500/10 text-yellow-500 mt-4' :
                  'bg-red-500/10 text-red-500 mt-4'
                }
              >
                {reportData.classification === 'excellent' ? 'Excelente' :
                 reportData.classification === 'good' ? 'Bom' :
                 reportData.classification === 'attention' ? 'Atenção' :
                 'Crítico'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle>Resumo por Severidade</CardTitle>
            </CardHeader>
            <CardContent>
              <M365SeverityBreakdown
                summary={{
                  critical: reportData.summary?.critical || 0,
                  high: reportData.summary?.high || 0,
                  medium: reportData.summary?.medium || 0,
                  low: reportData.summary?.low || 0,
                  total: reportData.summary?.total || 0,
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((cat: any) => (
                <M365CategoryCard
                  key={cat.category}
                  category={cat.category}
                  stats={{
                    count: cat.count || 0,
                    score: cat.score || 0,
                    criticalCount: cat.criticalCount || 0,
                    highCount: cat.highCount || 0,
                  }}
                  onClick={() => setSelectedCategory(cat.category)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Verificações
                {selectedCategory !== 'all' && (
                  <Badge variant="outline" className="ml-2">
                    {categories.find((c: any) => c.category === selectedCategory)?.label || selectedCategory}
                  </Badge>
                )}
              </CardTitle>
              {selectedCategory !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory('all')}>
                  Ver todas
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="failed">
              <TabsList>
                <TabsTrigger value="failed" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Problemas ({failedInsights.length})
                </TabsTrigger>
                <TabsTrigger value="passed" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Conformes ({passedInsights.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="failed" className="mt-4 space-y-4">
                {failedInsights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p>Nenhum problema encontrado nesta categoria!</p>
                  </div>
                ) : (
                  failedInsights.map((insight: any) => (
                    <M365InsightCard key={insight.id} insight={insight} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="passed" className="mt-4 space-y-4">
                {passedInsights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma verificação conforme nesta categoria.</p>
                  </div>
                ) : (
                  passedInsights.map((insight: any) => (
                    <M365InsightCard key={insight.id} insight={insight} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
