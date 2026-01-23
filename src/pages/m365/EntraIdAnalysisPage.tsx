import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useTenantConnection } from '@/hooks/useTenantConnection';
import { AppLayout } from '@/components/layout/AppLayout';
import { ScoreGauge } from '@/components/ScoreGauge';
import { StatCard } from '@/components/StatCard';
import { CategorySection } from '@/components/CategorySection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EntraIdComplianceReport } from '@/types/entraIdCompliance';
import { 
  Shield, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileDown,
  Link as LinkIcon,
  ArrowLeft
} from 'lucide-react';

export default function EntraIdAnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { tenants, loading: tenantsLoading, hasConnectedTenant } = useTenantConnection();
  
  const [report, setReport] = useState<EntraIdComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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

  const connectedTenants = tenants.filter(t => 
    t.connection_status === 'connected' || t.connection_status === 'partial'
  );

  const runAnalysis = async () => {
    if (connectedTenants.length === 0) {
      toast({
        title: 'Nenhum tenant conectado',
        description: 'Conecte um tenant Microsoft 365 primeiro.',
        variant: 'destructive',
      });
      return;
    }

    const tenantRecordId = connectedTenants[0].id;
    
    setAnalyzing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const { data, error } = await supabase.functions.invoke('entra-id-compliance', {
        body: { tenant_record_id: tenantRecordId },
      });

      if (error) {
        throw error;
      }

      setReport({
        ...data,
        generatedAt: new Date(data.generatedAt),
      });

      toast({
        title: 'Análise concluída',
        description: `Score de segurança: ${data.overallScore}/100`,
      });
    } catch (error: any) {
      console.error('Error running analysis:', error);
      toast({
        title: 'Erro na análise',
        description: error.message || 'Não foi possível executar a análise de compliance.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (authLoading) return null;

  // Show blocking message if no tenant is connected
  if (!tenantsLoading && !hasConnectedTenant) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">Microsoft 365</Badge>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">Entra ID</Badge>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">Análise de Segurança</Badge>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Análise de Segurança</h1>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para executar a análise de segurança, primeiro conecte um tenant Microsoft 365.
              </p>
              <Button asChild className="gap-2">
                <Link to="/scope-m365/tenant-connection">
                  <LinkIcon className="w-4 h-4" />
                  Conectar Tenant
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Microsoft 365</Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">Entra ID</Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">Análise de Segurança</Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Segurança do Entra ID</h1>
            <p className="text-muted-foreground">
              Identifica configurações inseguras, políticas ausentes e lacunas de segurança
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/scope-m365/entra-id" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Link>
            </Button>
            <Button 
              onClick={runAnalysis} 
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {analyzing ? 'Analisando...' : 'Analisar'}
            </Button>
          </div>
        </div>

        {/* Tenant Info */}
        {tenantsLoading ? (
          <Card className="mb-6">
            <CardContent className="py-4">
              <Skeleton className="h-5 w-48" />
            </CardContent>
          </Card>
        ) : connectedTenants.length > 0 && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      Tenant: {connectedTenants[0].display_name || connectedTenants[0].tenant_domain}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cliente: {connectedTenants[0].client.name}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  Conectado
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Initial State - No Report Yet */}
        {!report && !analyzing && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma análise realizada</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Clique em "Analisar" para executar uma verificação completa das configurações 
                de segurança do Entra ID, incluindo MFA, Acesso Condicional e mais.
              </p>
              <Button onClick={runAnalysis} className="gap-2">
                <Shield className="w-4 h-4" />
                Iniciar Análise
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {analyzing && (
          <Card>
            <CardContent className="py-16 text-center">
              <RefreshCw className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Analisando configurações...</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Verificando Security Defaults, políticas de Acesso Condicional, 
                métodos de autenticação, MFA e usuários privilegiados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Report */}
        {report && !analyzing && (
          <div className="space-y-6">
            {/* Licensing Notes */}
            {report.licensingNotes && report.licensingNotes.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-600 dark:text-amber-400">Aviso de Licenciamento</p>
                      <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                        {report.licensingNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score and Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Gauge */}
              <Card className="lg:col-span-1">
                <CardContent className="py-8 flex flex-col items-center">
                  <ScoreGauge score={report.overallScore} />
                  <p className="text-sm text-muted-foreground mt-4">
                    Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>

              {/* Stat Cards */}
              <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  title="Total"
                  value={report.totalChecks}
                  icon={CheckCircle2}
                  variant="default"
                  delay={0}
                />
                <StatCard
                  title="Aprovadas"
                  value={report.passed}
                  icon={CheckCircle2}
                  variant="success"
                  delay={0.1}
                />
                <StatCard
                  title="Falhas"
                  value={report.failed}
                  icon={XCircle}
                  variant="destructive"
                  delay={0.2}
                />
                <StatCard
                  title="Alertas"
                  value={report.warnings}
                  icon={AlertCircle}
                  variant="warning"
                  delay={0.3}
                />
              </div>
            </div>

            {/* Pending Checks Info */}
            {report.pending > 0 && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <p className="text-sm">
                      <span className="font-medium">{report.pending} verificação(ões)</span> não puderam ser executadas 
                      (geralmente por falta de licença Azure AD Premium ou permissões).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Critical Issues Banner */}
            {report.failed > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="font-medium text-destructive">
                        {report.failed} problema(s) crítico(s) identificado(s)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Revise as verificações abaixo e aplique as recomendações.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Categories */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Verificações por Categoria</h2>
              {report.categories.map((category, index) => (
                <CategorySection 
                  key={category.name} 
                  category={category} 
                  index={index} 
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
