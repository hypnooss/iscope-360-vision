import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { useTenantConnection } from '@/hooks/useTenantConnection';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  Users, 
  Key, 
  FileText,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Link as LinkIcon
} from 'lucide-react';

export default function EntraIdPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, loading: tenantsLoading, hasConnectedTenant } = useTenantConnection();

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

  if (authLoading) return null;

  const connectedTenants = tenants.filter(t => t.connection_status === 'connected' || t.connection_status === 'partial');

  // Show blocking message if no tenant is connected
  if (!tenantsLoading && !hasConnectedTenant) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb items={[
            { label: 'Microsoft 365', href: '/scope-m365' },
            { label: 'Entra ID' },
          ]} />
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Entra ID</h1>
              <p className="text-muted-foreground">
                Gestão de identidades e auditoria de acessos via Microsoft Graph
              </p>
            </div>
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tenant Microsoft 365 não conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para utilizar o Entra ID, primeiro conecte um tenant Microsoft 365 na página 
                de conexão centralizada. A conexão será compartilhada com todos os submódulos.
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
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365' },
          { label: 'Entra ID' },
        ]} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entra ID</h1>
            <p className="text-muted-foreground">
              Gestão de identidades e auditoria de acessos via Microsoft Graph
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Sincronizar Dados
          </Button>
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

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Security Analysis - Main Feature */}
          <Card 
            className="glass-card hover:shadow-lg transition-shadow cursor-pointer group border-primary/30"
            onClick={() => navigate('/scope-m365/entra-id/analysis')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Análise de Segurança</CardTitle>
              <CardDescription>
                Identifica configurações inseguras, políticas ausentes e lacunas de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Disponível
              </Badge>
            </CardContent>
          </Card>

          {/* Security Insights */}
          <Card 
            className="glass-card hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => navigate('/scope-m365/entra-id/security-insights')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <FileText className="w-6 h-6 text-orange-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Insights de Segurança</CardTitle>
              <CardDescription>
                Análise consolidada de riscos e indicadores de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                Disponível
              </Badge>
            </CardContent>
          </Card>

          {/* Users */}
          <Card className="glass-card hover:shadow-lg transition-shadow cursor-pointer group opacity-75">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Usuários</CardTitle>
              <CardDescription>
                Lista de usuários, status de conta e últimos acessos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Groups */}
          <Card className="glass-card hover:shadow-lg transition-shadow cursor-pointer group opacity-75">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Grupos</CardTitle>
              <CardDescription>
                Grupos de segurança, Microsoft 365 e distribuição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Applications */}
          <Card className="glass-card hover:shadow-lg transition-shadow cursor-pointer group opacity-75">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Key className="w-6 h-6 text-purple-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Aplicativos</CardTitle>
              <CardDescription>
                App Registrations, Enterprise Apps e permissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>

          {/* Conditional Access */}
          <Card className="glass-card hover:shadow-lg transition-shadow cursor-pointer group opacity-75">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Shield className="w-6 h-6 text-red-500" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">Acesso Condicional</CardTitle>
              <CardDescription>
                Políticas de acesso condicional e compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Em breve
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
