import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Cloud, CheckCircle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PermissionStatus {
  name: string;
  granted: boolean;
  type: 'required' | 'recommended';
}

interface M365Config {
  appId: string;
  clientSecret: string;
  isConfigured: boolean;
  permissions: PermissionStatus[];
  permissionsValidated: boolean;
}

export default function SettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingPermissions, setValidatingPermissions] = useState(false);
  const [m365Config, setM365Config] = useState<M365Config>({
    appId: '',
    clientSecret: '',
    isConfigured: false,
    permissions: [],
    permissionsValidated: false,
  });
  const [newAppId, setNewAppId] = useState('');
  const [newClientSecret, setNewClientSecret] = useState('');
  const [tenantIdForValidation, setTenantIdForValidation] = useState('');

  const defaultPermissions: PermissionStatus[] = [
    { name: 'User.Read.All', granted: false, type: 'required' },
    { name: 'Directory.Read.All', granted: false, type: 'required' },
    { name: 'Organization.Read.All', granted: false, type: 'required' },
    { name: 'Domain.Read.All', granted: false, type: 'required' },
    { name: 'Group.Read.All', granted: false, type: 'recommended' },
    { name: 'Application.Read.All', granted: false, type: 'recommended' },
    { name: 'Policy.Read.All', granted: false, type: 'recommended' },
    { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role !== 'super_admin') {
      navigate('/dashboard');
      toast.error('Acesso restrito a Super Administradores');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'super_admin') {
      checkM365Config();
    }
  }, [user, role]);

  const checkM365Config = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-m365-config');
      
      if (error) {
        console.error('Error checking M365 config:', error);
        setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: defaultPermissions, permissionsValidated: false });
      } else if (data?.configured && data?.app_id) {
        setM365Config({
          appId: data.app_id,
          clientSecret: data.masked_secret || '',
          isConfigured: data.has_client_secret,
          permissions: data.permissions || defaultPermissions,
          permissionsValidated: data.permissions_validated || false,
        });
        setNewAppId(data.app_id);
      } else {
        setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: defaultPermissions, permissionsValidated: false });
        setNewAppId('');
      }
    } catch (error) {
      console.error('Error:', error);
      setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: defaultPermissions, permissionsValidated: false });
    } finally {
      setLoading(false);
    }
  };

  const validatePermissions = async () => {
    if (!tenantIdForValidation.trim()) {
      toast.error('Informe o Tenant ID para validar as permissões');
      return;
    }

    setValidatingPermissions(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });

      // Need to call with query params - use a different approach
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-m365-config?validate_permissions=true&tenant_id=${encodeURIComponent(tenantIdForValidation)}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.permissions) {
        setM365Config(prev => ({
          ...prev,
          permissions: result.permissions,
          permissionsValidated: result.permissions_validated || true,
        }));
        toast.success('Permissões validadas com sucesso');
      }
    } catch (error) {
      console.error('Error validating permissions:', error);
      toast.error('Erro ao validar permissões');
    } finally {
      setValidatingPermissions(false);
    }
  };

  const handleSaveM365Config = async () => {
    if (!newAppId.trim()) {
      toast.error('O App ID é obrigatório');
      return;
    }
    
    // Only require secret if not configured or if user wants to update it
    if (!m365Config.isConfigured && !newClientSecret.trim()) {
      toast.error('O Client Secret é obrigatório para a configuração inicial');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('update-m365-config', {
        body: {
          app_id: newAppId.trim(),
          client_secret: newClientSecret.trim() || undefined,
        },
      });

      if (error) throw error;

      toast.success('Configurações do M365 atualizadas com sucesso');
      await checkM365Config();
      setNewClientSecret('');
    } catch (error) {
      console.error('Error saving M365 config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações globais do sistema
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="m365" className="space-y-6">
          <TabsList>
            <TabsTrigger value="m365" className="gap-2">
              <Cloud className="w-4 h-4" />
              Microsoft 365
            </TabsTrigger>
          </TabsList>

          <TabsContent value="m365" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Configuração Multi-Tenant do Microsoft 365
                      {m365Config.isConfigured ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Não Configurado
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Configure o Azure App Registration para permitir que clientes conectem seus tenants M365 ao sistema.
                      Este app deve ser registrado como Multi-Tenant no Azure AD.
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkM365Config}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Verificar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="appId">Application (Client) ID</Label>
                    <Input
                      id="appId"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={newAppId}
                      onChange={(e) => setNewAppId(e.target.value)}
                    />
                    {m365Config.isConfigured && m365Config.appId && (
                      <p className="text-xs text-green-600 font-mono">
                        Configurado: {m365Config.appId}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      O ID do aplicativo registrado no Azure AD
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <PasswordInput
                      id="clientSecret"
                      placeholder={m365Config.isConfigured ? 'Deixe em branco para manter' : 'Digite o Client Secret'}
                      value={newClientSecret}
                      onChange={(e) => setNewClientSecret(e.target.value)}
                    />
                    {m365Config.isConfigured && m365Config.clientSecret && (
                      <p className="text-xs text-green-600 font-mono">
                        Configurado: {m365Config.clientSecret}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {m365Config.isConfigured 
                        ? 'Deixe em branco para manter o valor atual' 
                        : 'O segredo do cliente gerado no Azure AD'}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">Instruções de Configuração:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure Portal → App Registrations</a></li>
                    <li>Crie um novo registro de aplicativo ou selecione um existente</li>
                    <li>Em "Supported account types", selecione "Accounts in any organizational directory (Any Azure AD directory - Multitenant)"</li>
                    <li>Copie o "Application (client) ID" e cole acima</li>
                    <li>Em "Certificates & secrets", crie um novo Client Secret e cole acima</li>
                    <li>Em "API permissions", adicione as permissões do Microsoft Graph necessárias</li>
                  </ol>
                </div>

                {/* Required Permissions Section */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">Permissões do Microsoft Graph Necessárias:</h4>
                      <p className="text-xs text-muted-foreground">
                        Adicione as seguintes permissões de <strong>Application</strong> no Azure AD:
                      </p>
                    </div>
                    {m365Config.permissionsValidated && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Validado
                      </Badge>
                    )}
                  </div>

                  {/* Validation Section */}
                  {m365Config.isConfigured && (
                    <div className="flex items-end gap-3 p-3 bg-background rounded-lg border">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="tenantValidation" className="text-xs">Tenant ID para Validação</Label>
                        <Input
                          id="tenantValidation"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={tenantIdForValidation}
                          onChange={(e) => setTenantIdForValidation(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={validatePermissions}
                        disabled={validatingPermissions || !tenantIdForValidation.trim()}
                      >
                        {validatingPermissions ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 mr-2" />
                        )}
                        Validar Permissões
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Obrigatórias</p>
                      <ul className="text-sm space-y-1">
                        {m365Config.permissions
                          .filter(p => p.type === 'required')
                          .map(perm => (
                            <li key={perm.name} className="flex items-center gap-2">
                              <span 
                                className={`w-2 h-2 rounded-full ${
                                  perm.granted ? 'bg-green-500' : 'bg-yellow-500'
                                }`}
                              />
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded">{perm.name}</code>
                            </li>
                          ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Recomendadas</p>
                      <ul className="text-sm space-y-1">
                        {m365Config.permissions
                          .filter(p => p.type === 'recommended')
                          .map(perm => (
                            <li key={perm.name} className="flex items-center gap-2">
                              <span 
                                className={`w-2 h-2 rounded-full ${
                                  perm.granted ? 'bg-green-500' : 'bg-yellow-500'
                                }`}
                              />
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded">{perm.name}</code>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ Lembre-se de conceder "Admin consent" para todas as permissões após adicioná-las.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveM365Config} disabled={saving}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
