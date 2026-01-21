import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTenantConnection } from '@/hooks/useTenantConnection';
import { TenantStatusCard } from '@/components/m365/TenantStatusCard';
import { TenantConnectionWizard } from '@/components/m365/TenantConnectionWizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { 
  Shield, 
  Plus,
  Link as LinkIcon,
  Info,
  AlertCircle
} from 'lucide-react';

export default function TenantConnectionPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const { tenants, loading, refetch, testConnection, disconnectTenant, deleteTenant } = useTenantConnection();
  const [showWizard, setShowWizard] = useState(false);

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

  const handleTest = async (tenantId: string) => {
    const result = await testConnection(tenantId);
    if (result.success) {
      toast({
        title: 'Conexão testada',
        description: 'A conexão com o tenant foi validada com sucesso.',
      });
    } else {
      toast({
        title: 'Erro ao testar',
        description: result.error || 'Não foi possível testar a conexão.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleDisconnect = async (tenantId: string) => {
    const result = await disconnectTenant(tenantId);
    if (result.success) {
      toast({
        title: 'Tenant desconectado',
        description: 'O tenant foi desconectado. Você pode reconectá-lo a qualquer momento.',
      });
    } else {
      toast({
        title: 'Erro ao desconectar',
        description: result.error || 'Não foi possível desconectar o tenant.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleDelete = async (tenantId: string) => {
    const result = await deleteTenant(tenantId);
    if (result.success) {
      toast({
        title: 'Tenant excluído',
        description: 'O tenant e todas as suas configurações foram removidos permanentemente.',
      });
    } else {
      toast({
        title: 'Erro ao excluir',
        description: result.error || 'Não foi possível excluir o tenant.',
        variant: 'destructive',
      });
    }
    return result;
  };

  const handleUpdatePermissions = (tenantId: string) => {
    // TODO: Open update permissions wizard for the specific tenant
    toast({
      title: 'Em desenvolvimento',
      description: 'O upgrade de permissões será implementado em breve.',
    });
  };

  if (authLoading) return null;

  const connectedTenants = tenants.filter(t => t.connection_status === 'connected' || t.connection_status === 'partial');
  const pendingTenants = tenants.filter(t => t.connection_status === 'pending');
  const disconnectedTenants = tenants.filter(t => t.connection_status === 'disconnected' || t.connection_status === 'failed');

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Microsoft 365</Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Conexão com Tenant</h1>
            <p className="text-muted-foreground">
              Gerencie as conexões dos tenants Microsoft 365 para todos os submódulos
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Conectar Tenant
          </Button>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Conexão Centralizada</p>
                <p className="text-sm text-muted-foreground">
                  A conexão do tenant é compartilhada entre todos os submódulos do Microsoft 365 
                  (Entra ID, SharePoint, Exchange, Defender, Intune). Configure uma vez e 
                  utilize em todos os módulos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenants List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="glass-card">
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum tenant conectado</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Conecte um tenant Microsoft 365 para começar a utilizar os submódulos 
                de auditoria e análise de segurança.
              </p>
              <Button onClick={() => setShowWizard(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Conectar Primeiro Tenant
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Connected Tenants */}
            {connectedTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <LinkIcon className="w-4 h-4 text-green-500" />
                  <h2 className="text-lg font-semibold">Tenants Conectados</h2>
                  <Badge variant="secondary">{connectedTenants.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {connectedTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                      onUpdatePermissions={handleUpdatePermissions}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Tenants */}
            {pendingTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-lg font-semibold">Aguardando Consentimento</h2>
                  <Badge variant="secondary">{pendingTenants.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pendingTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Disconnected Tenants */}
            {disconnectedTenants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-muted-foreground">Desconectados</h2>
                  <Badge variant="outline">{disconnectedTenants.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
                  {disconnectedTenants.map((tenant) => (
                    <TenantStatusCard
                      key={tenant.id}
                      tenant={tenant}
                      onTest={handleTest}
                      onDisconnect={handleDisconnect}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connection Wizard Dialog */}
        <TenantConnectionWizard 
          open={showWizard} 
          onOpenChange={setShowWizard}
          onSuccess={() => {
            setShowWizard(false);
            refetch();
          }}
        />
      </div>
    </AppLayout>
  );
}
