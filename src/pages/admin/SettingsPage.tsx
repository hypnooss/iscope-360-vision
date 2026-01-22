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
import { Loader2, Save, Cloud, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface M365Config {
  appId: string;
  clientSecret: string;
  isConfigured: boolean;
}

export default function SettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [m365Config, setM365Config] = useState<M365Config>({
    appId: '',
    clientSecret: '',
    isConfigured: false,
  });
  const [newAppId, setNewAppId] = useState('');
  const [newClientSecret, setNewClientSecret] = useState('');

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
        setM365Config({ appId: '', clientSecret: '', isConfigured: false });
      } else if (data?.configured && data?.app_id) {
        // Only set as configured if app_id is valid and not a placeholder
        setM365Config({
          appId: data.app_id,
          clientSecret: data.has_client_secret ? '••••••••••••••••' : '',
          isConfigured: data.has_client_secret,
        });
        setNewAppId(data.app_id);
      } else {
        // Not configured or invalid
        setM365Config({ appId: '', clientSecret: '', isConfigured: false });
        setNewAppId('');
      }
    } catch (error) {
      console.error('Error:', error);
      setM365Config({ appId: '', clientSecret: '', isConfigured: false });
    } finally {
      setLoading(false);
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
                    <p className="text-xs text-muted-foreground">
                      O ID do aplicativo registrado no Azure AD
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <PasswordInput
                      id="clientSecret"
                      placeholder={m365Config.isConfigured ? '••••••••••••••••' : 'Digite o Client Secret'}
                      value={newClientSecret}
                      onChange={(e) => setNewClientSecret(e.target.value)}
                    />
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
