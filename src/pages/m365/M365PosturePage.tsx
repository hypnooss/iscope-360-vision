import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  AlertTriangle, 
  Calendar,
  Building2,
  ArrowLeft
} from 'lucide-react';
import { 
  M365ScoreGauge, 
  M365CategoryCard, 
  M365SeverityBreakdown,
  M365InsightCard
} from '@/components/m365/posture';
import { useM365SecurityPosture } from '@/hooks/useM365SecurityPosture';
import { 
  M365RiskCategory, 
  CATEGORY_LABELS,
  groupInsightsByCategory 
} from '@/types/m365Insights';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function M365PosturePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [tenantRecordId, setTenantRecordId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ displayName: string; domain: string } | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useM365SecurityPosture({ 
    tenantRecordId: tenantRecordId || '' 
  });

  // Auth and module access check
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

  // Load tenant from URL param or fetch first connected tenant
  useEffect(() => {
    async function loadTenant() {
      const paramTenantId = searchParams.get('tenant');
      
      if (paramTenantId) {
        setTenantRecordId(paramTenantId);
        // Fetch tenant info
        const { data: tenant } = await supabase
          .from('m365_tenants')
          .select('display_name, tenant_domain')
          .eq('id', paramTenantId)
          .single();
        
        if (tenant) {
          setTenantInfo({
            displayName: tenant.display_name || 'Tenant M365',
            domain: tenant.tenant_domain || '',
          });
        }
      } else {
        // Fetch first connected tenant for user's client
        const { data: tenants, error: fetchError } = await supabase
          .from('m365_tenants')
          .select('id, display_name, tenant_domain')
          .eq('connection_status', 'connected')
          .limit(1)
          .single();
        
        if (fetchError) {
          toast({
            title: 'Nenhum tenant conectado',
            description: 'Conecte um tenant Microsoft 365 para continuar.',
            variant: 'destructive',
          });
          navigate('/scope-m365/tenant-connection');
          return;
        }
        
        if (tenants) {
          setTenantRecordId(tenants.id);
          setTenantInfo({
            displayName: tenants.display_name || 'Tenant M365',
            domain: tenants.tenant_domain || '',
          });
        }
      }
      setLoadingTenant(false);
    }
    
    if (user) {
      loadTenant();
    }
  }, [user, searchParams, navigate, toast]);

  // Trigger analysis when tenant is loaded
  useEffect(() => {
    if (tenantRecordId && !loadingTenant) {
      refetch();
    }
  }, [tenantRecordId, loadingTenant, refetch]);

  if (authLoading || loadingTenant) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const groupedInsights = data?.insights ? groupInsightsByCategory(data.insights) : null;
  const failedInsights = data?.insights?.filter(i => i.status === 'fail') || [];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <PageBreadcrumb 
              items={[
                { label: 'Microsoft 365', href: '/scope-m365/dashboard' },
                { label: 'Postura de Segurança' }
              ]} 
            />
            <h1 className="text-2xl font-bold text-foreground mt-2">Postura de Segurança</h1>
            <p className="text-muted-foreground">
              Análise consolidada do ambiente Microsoft 365
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/scope-m365/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={() => refetch()} 
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Analisando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && !data && (
          <Card className="glass-card border-destructive/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <p className="font-semibold">Erro na análise</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score Header */}
        <Card className="glass-card overflow-hidden">
          <div className="bg-gradient-to-br from-card via-card to-muted/20 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Score Gauge */}
              <div className="flex-shrink-0">
                <M365ScoreGauge
                  score={data?.score ?? 0}
                  classification={data?.classification ?? 'critical'}
                  size="lg"
                  loading={isLoading}
                />
              </div>

              {/* Tenant Info */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg font-semibold text-foreground">
                    {tenantInfo?.displayName || 'Carregando...'}
                  </span>
                </div>
                {tenantInfo?.domain && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {tenantInfo.domain}
                  </p>
                )}
                
                {data?.analyzedAt && (
                  <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Última análise: {new Date(data.analyzedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}

                {data?.cached && (
                  <Badge variant="secondary" className="mt-2">
                    Resultado em cache
                  </Badge>
                )}
              </div>

              {/* Severity Breakdown */}
              <div className="w-full lg:w-auto lg:min-w-[400px]">
                <M365SeverityBreakdown
                  summary={data?.summary ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 }}
                  loading={isLoading}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Categories Grid */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Categorias de Risco</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.categoryBreakdown?.map((category) => (
              <M365CategoryCard
                key={category.category}
                category={category.category}
                stats={{
                  count: category.count,
                  score: category.score,
                  criticalCount: category.criticalCount,
                  highCount: category.highCount,
                }}
                onClick={() => {
                  // Scroll to category section
                  const element = document.getElementById(`category-${category.category}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                loading={isLoading}
              />
            ))}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Insights by Category */}
        {groupedInsights && (
          <div className="space-y-8">
            <h2 className="text-lg font-semibold text-foreground">Insights Detalhados</h2>
            
            {(Object.keys(groupedInsights) as M365RiskCategory[]).map((category) => {
              const categoryInsights = groupedInsights[category];
              if (categoryInsights.length === 0) return null;
              
              const failedCount = categoryInsights.filter(i => i.status === 'fail').length;
              
              return (
                <div key={category} id={`category-${category}`} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-base font-semibold text-foreground">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <Badge variant="secondary">
                      {categoryInsights.length} verificação{categoryInsights.length !== 1 ? 'ões' : ''}
                    </Badge>
                    {failedCount > 0 && (
                      <Badge variant="outline" className="status-fail">
                        {failedCount} falha{failedCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {categoryInsights.map((insight) => (
                      <M365InsightCard key={insight.id} insight={insight} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!data?.insights || data.insights.length === 0) && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum insight disponível
              </h3>
              <p className="text-muted-foreground mb-4">
                Clique em "Atualizar" para executar a análise de segurança.
              </p>
              <Button onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Iniciar Análise
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
