import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { usePreview } from '@/contexts/PreviewContext';
import { usePreviewGuard } from '@/hooks/usePreviewGuard';
import { useM365TenantSelector } from '@/hooks/useM365TenantSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  AlertTriangle, 
  Calendar,
  ArrowLeft,
  Lock,
  Server,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { 
  M365CategoryCard, 
  M365SeverityBreakdown,
  M365InsightCard,
  TenantSelector
} from '@/components/m365/posture';
import { ScoreGauge } from '@/components/ScoreGauge';
import { useM365SecurityPosture } from '@/hooks/useM365SecurityPosture';
import { 
  M365RiskCategory, 
  CATEGORY_LABELS,
  groupInsightsByCategory 
} from '@/types/m365Insights';

export default function M365PosturePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const { isPreviewMode } = usePreview();
  const { isBlocked, showBlockedMessage } = usePreviewGuard();
  const navigate = useNavigate();
  
  const { tenants, selectedTenantId, selectedTenant, selectTenant, loading: tenantsLoading } = useM365TenantSelector();

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    triggerAnalysis,
    agentInsights,
    agentStatus,
    isAgentPending,
  } = useM365SecurityPosture({ 
    tenantRecordId: selectedTenantId || '' 
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

  // Fetch latest analysis from history when tenant changes (no auto-trigger)
  // Analysis is now triggered only by user clicking "Atualizar" button

  // Handle refresh with Preview Mode guard - now triggers full analysis
  const handleRefresh = useCallback(async () => {
    if (isBlocked) {
      showBlockedMessage();
      return;
    }
    await triggerAnalysis();
  }, [isBlocked, showBlockedMessage, triggerAnalysis]);

  if (authLoading || tenantsLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const groupedInsights = data?.insights ? groupInsightsByCategory(data.insights) : null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              onClick={handleRefresh} 
              disabled={isLoading || !selectedTenantId}
              variant={isBlocked ? 'outline' : 'default'}
            >
              {isBlocked && <Lock className="w-4 h-4 mr-2" />}
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

        {/* No tenants state */}
        {tenants.length === 0 && (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum tenant disponível
              </h3>
              <p className="text-muted-foreground mb-4">
                {isPreviewMode 
                  ? 'O usuário visualizado não possui tenants M365 conectados.'
                  : 'Conecte um tenant Microsoft 365 para analisar a postura de segurança.'}
              </p>
              {!isPreviewMode && (
                <Button onClick={() => navigate('/scope-m365/tenant-connection')}>
                  Conectar Tenant
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main content - only show if tenants available */}
        {tenants.length > 0 && (
          <>
            {/* Score Header */}
            <Card className="glass-card overflow-hidden">
              <div className="bg-gradient-to-br from-card via-card to-muted/20 p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="flex-shrink-0">
                    <ScoreGauge
                      score={data?.score ?? 0}
                      size="lg"
                      loading={isLoading}
                    />
                  </div>

                  <div className="flex-1 text-center lg:text-left">
                    <div className="mb-4">
                      <TenantSelector
                        tenants={tenants}
                        selectedId={selectedTenantId}
                        onSelect={selectTenant}
                        loading={isLoading}
                        disabled={isBlocked}
                      />
                    </div>
                    
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

                    {data?.errors && data.errors.length > 0 && (
                      <Badge variant="outline" className="mt-2 text-warning border-warning/30">
                        {data.errors.length} aviso(s) durante coleta
                      </Badge>
                    )}
                  </div>

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
                      criticalCount: category.criticalCount ?? 0,
                      highCount: category.highCount ?? 0,
                    }}
                    onClick={() => {
                      const element = document.getElementById(`category-${category.category}`);
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    loading={isLoading}
                  />
                ))}
              </div>
            </div>

            {/* Agent Insights Section */}
            {(agentInsights.length > 0 || isAgentPending) && (
              <>
                <Separator className="my-8" />
                
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Server className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-base">Coleta via Agent (PowerShell)</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {agentStatus === 'completed' && (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Concluído
                          </Badge>
                        )}
                        {isAgentPending && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            <Clock className="w-3 h-3 mr-1 animate-pulse" />
                            Aguardando Agent
                          </Badge>
                        )}
                        {agentStatus === 'failed' && (
                          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                            <XCircle className="w-3 h-3 mr-1" />
                            Falhou
                          </Badge>
                        )}
                        {agentStatus === 'partial' && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Parcial
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Dados coletados do Exchange Online e SharePoint via PowerShell
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isAgentPending && agentInsights.length === 0 && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        <span>Aguardando agent processar coleta...</span>
                      </div>
                    )}
                    
                    {agentInsights.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {agentInsights.map((insight) => (
                          <Card key={insight.id} className="border bg-card/50">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-sm">{insight.name}</h4>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    insight.status === 'pass' ? 'text-green-600 border-green-200' :
                                    insight.status === 'fail' ? 'text-red-600 border-red-200' :
                                    insight.status === 'warn' ? 'text-amber-600 border-amber-200' :
                                    'text-slate-600 border-slate-200'
                                  }
                                >
                                  {insight.status === 'pass' ? 'OK' : 
                                   insight.status === 'fail' ? 'Falha' :
                                   insight.status === 'warn' ? 'Atenção' : 'N/A'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                              {insight.details && (
                                <p className="text-xs text-muted-foreground/80 bg-muted/50 p-2 rounded">{insight.details}</p>
                              )}
                              {insight.affectedEntities && insight.affectedEntities.length > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <span className="font-medium">{insight.affectedEntities.length} entidade(s) afetada(s)</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            <Separator className="my-8" />

            {/* Insights by Category */}
            {groupedInsights && (
              <div className="space-y-8">
                <h2 className="text-lg font-semibold text-foreground">Insights Detalhados (Graph API)</h2>
                
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
                  <Button onClick={handleRefresh} disabled={isBlocked}>
                    {isBlocked && <Lock className="w-4 h-4 mr-2" />}
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Iniciar Análise
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
