import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Unplug,
  Plus,
  Clock,
  Building
} from 'lucide-react';
import { TenantConnectionWizard } from '@/components/m365/TenantConnectionWizard';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TenantConnection {
  id: string;
  tenant_id: string;
  tenant_domain: string | null;
  display_name: string | null;
  connection_status: 'pending' | 'connected' | 'partial' | 'failed' | 'disconnected';
  last_validated_at: string | null;
  created_at: string;
  client: {
    id: string;
    name: string;
  };
}

export default function EntraIdPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess } = useModules();
  const navigate = useNavigate();
  
  const [tenants, setTenants] = useState<TenantConnection[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (user) {
      fetchTenants();
    }
  }, [user]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('m365_tenants')
        .select(`
          id,
          tenant_id,
          tenant_domain,
          display_name,
          connection_status,
          last_validated_at,
          created_at,
          clients!inner(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((t: any) => ({
        ...t,
        client: t.clients
      }));

      setTenants(formattedData);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: TenantConnection['connection_status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Parcial</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      case 'disconnected':
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20"><Unplug className="w-3 h-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
  };

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Microsoft 365</Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Entra ID</h1>
            <p className="text-muted-foreground">
              Gestão de identidades e auditoria de acessos via Microsoft Graph
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Conectar Tenant
          </Button>
        </div>

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
                Conecte um tenant Microsoft 365 para começar a coletar dados do Entra ID 
                e realizar auditorias de segurança.
              </p>
              <Button onClick={() => setShowWizard(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Conectar Primeiro Tenant
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tenants.map((tenant) => (
              <Card key={tenant.id} className="glass-card hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Building className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {tenant.display_name || tenant.tenant_domain || 'Tenant sem nome'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {tenant.client.name}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(tenant.connection_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tenant ID:</span>
                      <span className="font-mono text-xs">{tenant.tenant_id.slice(0, 8)}...</span>
                    </div>
                    {tenant.tenant_domain && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Domínio:</span>
                        <span>{tenant.tenant_domain}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última validação:</span>
                      <span>
                        {tenant.last_validated_at 
                          ? formatDistanceToNow(new Date(tenant.last_validated_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })
                          : 'Nunca'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Testar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Unplug className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Connection Wizard Dialog */}
        <TenantConnectionWizard 
          open={showWizard} 
          onOpenChange={setShowWizard}
          onSuccess={() => {
            setShowWizard(false);
            fetchTenants();
          }}
        />
      </div>
    </AppLayout>
  );
}
