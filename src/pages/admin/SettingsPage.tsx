import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Cloud, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, Clock, Bell, Layers, Bot, Upload, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModulesManagement } from '@/components/admin/ModulesManagement';

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
  lastValidatedAt: string | null;
  validationTenantId: string | null;
  // Azure certificate upload config
  appObjectId: string | null;
  homeTenantId: string | null;
  hasAzureConfig: boolean;
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
    lastValidatedAt: null,
    validationTenantId: null,
    appObjectId: null,
    homeTenantId: null,
    hasAzureConfig: false,
  });
  const [newAppId, setNewAppId] = useState('');
  const [newClientSecret, setNewClientSecret] = useState('');
  const [tenantIdForValidation, setTenantIdForValidation] = useState('');
  // Azure certificate upload config
  const [newAppObjectId, setNewAppObjectId] = useState('');
  const [newHomeTenantId, setNewHomeTenantId] = useState('');
  
  // Agent settings
  const [agentHeartbeatInterval, setAgentHeartbeatInterval] = useState<number>(120);
  const [loadingAgentSettings, setLoadingAgentSettings] = useState(false);
  const [savingAgentSettings, setSavingAgentSettings] = useState(false);

  // Agent update management
  const [agentLatestVersion, setAgentLatestVersion] = useState('');
  const [agentForceUpdate, setAgentForceUpdate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [calculatedChecksum, setCalculatedChecksum] = useState('');
  const [calculatingChecksum, setCalculatingChecksum] = useState(false);
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [agentStats, setAgentStats] = useState<{
    total: number;
    upToDate: number;
    outdated: { name: string; version: string; client: string }[];
  }>({ total: 0, upToDate: 0, outdated: [] });

  const defaultPermissions: PermissionStatus[] = [
    // Core permissions
    { name: 'User.Read.All', granted: false, type: 'required' },
    { name: 'Directory.Read.All', granted: false, type: 'required' },
    { name: 'Organization.Read.All', granted: false, type: 'required' },
    { name: 'Domain.Read.All', granted: false, type: 'required' },
    // Entra ID / Security
    { name: 'Group.Read.All', granted: false, type: 'recommended' },
    { name: 'Application.Read.All', granted: false, type: 'recommended' },
    { name: 'Policy.Read.All', granted: false, type: 'recommended' },
    { name: 'Reports.Read.All', granted: false, type: 'recommended' },
    { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
    // Exchange Online
    { name: 'MailboxSettings.Read', granted: false, type: 'recommended' },
    { name: 'Mail.Read', granted: false, type: 'recommended' },
  ];

  // Group permissions by module for display
  const corePermissions = ['User.Read.All', 'Directory.Read.All', 'Organization.Read.All', 'Domain.Read.All'];
  const entraIdPermissions = ['Group.Read.All', 'Application.Read.All', 'Policy.Read.All', 'Reports.Read.All', 'RoleManagement.Read.Directory'];
  const exchangeOnlinePermissions = ['MailboxSettings.Read', 'Mail.Read'];

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
      loadAgentSettings();
      loadAgentUpdateSettings();
      loadAgentStats();
      
      // Polling every 5 seconds to keep agent stats synchronized
      const interval = setInterval(() => {
        loadAgentStats();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user, role]);

  const loadAgentSettings = async () => {
    setLoadingAgentSettings(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'agent_heartbeat_interval')
        .maybeSingle();
      
      if (data?.value) {
        setAgentHeartbeatInterval(Number(data.value) || 120);
      }
    } catch (error) {
      console.error('Error loading agent settings:', error);
    } finally {
      setLoadingAgentSettings(false);
    }
  };

  const loadAgentUpdateSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['agent_latest_version', 'agent_force_update']);

      if (data) {
        data.forEach(setting => {
          if (setting.key === 'agent_latest_version') {
            const version = typeof setting.value === 'string' 
              ? setting.value.replace(/"/g, '') 
              : String(setting.value || '');
            setAgentLatestVersion(version);
          }
          if (setting.key === 'agent_force_update') {
            setAgentForceUpdate(setting.value === true || setting.value === 'true');
          }
        });
      }
    } catch (error) {
      console.error('Error loading agent update settings:', error);
    }
  };

  const loadAgentStats = async () => {
    try {
      // Get all agents with their versions and client info
      const { data: agents, error } = await supabase
        .from('agents')
        .select(`
          id,
          name,
          agent_version,
          revoked,
          clients!agents_client_id_fkey (name)
        `)
        .eq('revoked', false);

      if (error) throw error;

      // Get the latest version from system_settings
      const { data: versionSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'agent_latest_version')
        .maybeSingle();

      const latestVersion = versionSetting?.value 
        ? (typeof versionSetting.value === 'string' 
          ? versionSetting.value.replace(/"/g, '') 
          : String(versionSetting.value))
        : '';

      if (agents) {
        const upToDate = agents.filter(a => a.agent_version === latestVersion).length;
        const outdated = agents
          .filter(a => a.agent_version && a.agent_version !== latestVersion)
          .map(a => ({
            name: a.name,
            version: a.agent_version || 'N/A',
            client: (a.clients as any)?.name || 'Sem cliente'
          }));

        setAgentStats({
          total: agents.length,
          upToDate,
          outdated
        });
      }
    } catch (error) {
      console.error('Error loading agent stats:', error);
    }
  };

  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.tar.gz')) {
      toast.error('Selecione um arquivo .tar.gz');
      return;
    }

    setSelectedFile(file);
    setCalculatingChecksum(true);
    
    try {
      const checksum = await calculateSHA256(file);
      setCalculatedChecksum(checksum);
    } catch (error) {
      toast.error('Erro ao calcular checksum');
      console.error('Error calculating checksum:', error);
    } finally {
      setCalculatingChecksum(false);
    }
  };

  const handlePublishUpdate = async () => {
    if (!selectedFile || !newVersion) {
      toast.error('Selecione um arquivo e informe a versão');
      return;
    }

    if (!calculatedChecksum) {
      toast.error('Aguarde o cálculo do checksum');
      return;
    }

    setPublishingUpdate(true);
    try {
      // 1. Upload versioned file to Supabase Storage
      const versionedFilename = `iscope-agent-${newVersion}.tar.gz`;
      const { error: uploadError } = await supabase.storage
        .from('agent-releases')
        .upload(versionedFilename, selectedFile, {
          upsert: true,
          contentType: 'application/gzip'
        });

      if (uploadError) throw uploadError;

      // 2. Also upload as 'latest' for default installations
      const { error: latestUploadError } = await supabase.storage
        .from('agent-releases')
        .upload('iscope-agent-latest.tar.gz', selectedFile, {
          upsert: true,
          contentType: 'application/gzip'
        });

      if (latestUploadError) {
        console.error('Error uploading latest:', latestUploadError);
        toast.warning('Versão publicada, mas erro ao atualizar arquivo latest');
      }

      // 2. Update system_settings (upsert pattern)
      const settings = [
        { key: 'agent_latest_version', value: newVersion },
        { key: 'agent_update_checksum', value: calculatedChecksum },
        { key: 'agent_force_update', value: agentForceUpdate }
      ];

      for (const setting of settings) {
        // Try update first
        const { data: updateData, error: updateError } = await supabase
          .from('system_settings')
          .update({
            value: setting.value,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', setting.key)
          .select();

        // If no row was updated, insert
        if (!updateError && (!updateData || updateData.length === 0)) {
          await supabase
            .from('system_settings')
            .insert({
              key: setting.key,
              value: setting.value,
              updated_by: user?.id,
              description: setting.key === 'agent_latest_version' 
                ? 'Versão mais recente do agent' 
                : setting.key === 'agent_update_checksum'
                ? 'Checksum SHA256 do pacote do agent'
                : 'Forçar atualização ignorando tarefas pendentes'
            });
        }
      }

      toast.success(`Versão ${newVersion} publicada com sucesso!`);
      setAgentLatestVersion(newVersion);
      setNewVersion('');
      setSelectedFile(null);
      setCalculatedChecksum('');
      
      // Clear file input
      const fileInput = document.getElementById('agentPackageFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      await loadAgentStats();
    } catch (error) {
      console.error('Error publishing update:', error);
      toast.error('Erro ao publicar atualização');
    } finally {
      setPublishingUpdate(false);
    }
  };

  const handleSaveAgentSettings = async () => {
    // Validate range
    if (agentHeartbeatInterval < 60 || agentHeartbeatInterval > 300) {
      toast.error('O intervalo deve estar entre 60 e 300 segundos');
      return;
    }

    setSavingAgentSettings(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          value: agentHeartbeatInterval,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'agent_heartbeat_interval');

      if (error) throw error;
      toast.success('Configurações de agents salvas com sucesso');
    } catch (error) {
      console.error('Error saving agent settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingAgentSettings(false);
    }
  };

  const checkM365Config = async () => {
    try {
      setLoading(true);
      
      // Verify session is still valid before calling
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('get-m365-config');
      
      if (error) {
        console.error('Error checking M365 config:', error);
        
        // Handle authentication errors with session refresh retry
        const errorMessage = error.message || '';
        if (errorMessage.includes('401') || errorMessage.includes('Invalid') || errorMessage.includes('expired') || errorMessage.includes('non-2xx')) {
          console.log('Token may be expired, attempting session refresh...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            console.error('Session refresh failed:', refreshError?.message);
            // Force sign out to clear stale session data
            await supabase.auth.signOut();
            toast.error('Sessão expirada. Por favor, faça login novamente.');
            navigate('/auth');
            return;
          }
          
          // Retry after successful refresh
          const { data: retryData, error: retryError } = await supabase.functions.invoke('get-m365-config');
          
          if (retryError) {
            console.error('Retry also failed:', retryError);
            // If retry still fails, force logout
            await supabase.auth.signOut();
            toast.error('Erro de autenticação. Por favor, faça login novamente.');
            navigate('/auth');
            return;
          }
          
          if (retryData?.configured && retryData?.app_id) {
            setM365Config({
              appId: retryData.app_id,
              clientSecret: retryData.masked_secret || '',
              isConfigured: retryData.has_client_secret,
              permissions: (retryData.permissions && retryData.permissions.length > 0) ? retryData.permissions : defaultPermissions,
              permissionsValidated: retryData.permissions_validated || false,
              lastValidatedAt: retryData.last_validated_at || null,
              validationTenantId: retryData.validation_tenant_id || null,
              appObjectId: retryData.app_object_id || null,
              homeTenantId: retryData.home_tenant_id || null,
              hasAzureConfig: retryData.has_azure_config || false,
            });
            setNewAppId(retryData.app_id);
            if (retryData.app_object_id) {
              setNewAppObjectId(retryData.app_object_id);
            }
            if (retryData.home_tenant_id) {
              setNewHomeTenantId(retryData.home_tenant_id);
            }
            if (retryData.validation_tenant_id) {
              setTenantIdForValidation(retryData.validation_tenant_id);
            }
            return;
          }
        }
        
        setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: [...defaultPermissions], permissionsValidated: false, lastValidatedAt: null, validationTenantId: null, appObjectId: null, homeTenantId: null, hasAzureConfig: false });
      } else if (data?.configured && data?.app_id) {
        setM365Config({
          appId: data.app_id,
          clientSecret: data.masked_secret || '',
          isConfigured: data.has_client_secret,
          permissions: (data.permissions && data.permissions.length > 0) ? data.permissions : defaultPermissions,
          permissionsValidated: data.permissions_validated || false,
          lastValidatedAt: data.last_validated_at || null,
          validationTenantId: data.validation_tenant_id || null,
          appObjectId: data.app_object_id || null,
          homeTenantId: data.home_tenant_id || null,
          hasAzureConfig: data.has_azure_config || false,
        });
        setNewAppId(data.app_id);
        if (data.app_object_id) {
          setNewAppObjectId(data.app_object_id);
        }
        if (data.home_tenant_id) {
          setNewHomeTenantId(data.home_tenant_id);
        }
        // Restore tenant ID if we have a saved one
        if (data.validation_tenant_id) {
          setTenantIdForValidation(data.validation_tenant_id);
        }
      } else {
        setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: [...defaultPermissions], permissionsValidated: false, lastValidatedAt: null, validationTenantId: null, appObjectId: null, homeTenantId: null, hasAzureConfig: false });
        setNewAppId('');
      }
    } catch (error) {
      console.error('Error:', error);
      setM365Config({ appId: '', clientSecret: '', isConfigured: false, permissions: [...defaultPermissions], permissionsValidated: false, lastValidatedAt: null, validationTenantId: null, appObjectId: null, homeTenantId: null, hasAzureConfig: false });
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
      // Call the validate-m365-permissions edge function
      const { data, error } = await supabase.functions.invoke('validate-m365-permissions', {
        body: { tenant_id: tenantIdForValidation }
      });

      // Handle function errors (but check if response has useful data)
      if (error) {
        console.error('Edge function error:', error);
        // Even on error, the tenant_id might have been saved
        // Re-fetch config to get the latest state
        await checkM365Config();
        throw new Error(error.message || 'Erro ao chamar função de validação');
      }

      if (data.success && data.permissions) {
        setM365Config(prev => ({
          ...prev,
          permissions: data.permissions,
          permissionsValidated: true,
          lastValidatedAt: data.validatedAt,
          validationTenantId: tenantIdForValidation,
        }));
        
        const failedRequired = data.failedRequired || 0;
        const failedRecommended = data.failedRecommended || 0;
        
        if (failedRequired > 0) {
          toast.error(`${failedRequired} permissão(ões) obrigatória(s) não concedida(s)`);
        } else if (failedRecommended > 0) {
          toast.warning(`Validado, mas ${failedRecommended} permissão(ões) recomendada(s) faltando`);
        } else {
          toast.success('Todas as permissões validadas com sucesso!');
        }
      } else if (data.skipped) {
        toast.info(data.message || 'Validação ignorada');
      } else if (data.tenantIdSaved) {
        // Tenant ID was saved but validation failed
        setM365Config(prev => ({
          ...prev,
          validationTenantId: tenantIdForValidation,
        }));
        toast.error(data.error || 'Falha na validação. Verifique o Tenant ID e se o Admin Consent foi concedido.');
      } else {
        throw new Error(data.error || 'Erro desconhecido na validação');
      }
    } catch (error: any) {
      console.error('Error validating permissions:', error);
      toast.error(error.message || 'Erro ao validar permissões. Verifique o Tenant ID e as credenciais.');
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
          app_object_id: newAppObjectId.trim() || undefined,
          home_tenant_id: newHomeTenantId.trim() || undefined,
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
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Configurações' }]} />
        
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
            <TabsTrigger value="modules" className="gap-2">
              <Layers className="w-4 h-4" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="w-4 h-4" />
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="m365" className="space-y-6">
            <Card className="border-border/50">
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

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Obrigatórias (Core)</p>
                      <ul className="text-sm space-y-1">
                        {m365Config.permissions
                          .filter(p => corePermissions.includes(p.name))
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
                      <p className="text-xs font-medium text-muted-foreground">Entra ID / Security</p>
                      <ul className="text-sm space-y-1">
                        {m365Config.permissions
                          .filter(p => entraIdPermissions.includes(p.name))
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
                      <p className="text-xs font-medium text-muted-foreground">Exchange Online</p>
                      <ul className="text-sm space-y-1">
                        {m365Config.permissions
                          .filter(p => exchangeOnlinePermissions.includes(p.name))
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

                {/* Automated Validation Status - Separate Card */}
                {m365Config.lastValidatedAt && (
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Bell className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Monitoramento Automático</p>
                          <p className="text-xs text-muted-foreground">
                            As permissões são validadas automaticamente a cada hora
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Última validação: {format(new Date(m365Config.lastValidatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {m365Config.validationTenantId && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Tenant: {m365Config.validationTenantId.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                {/* Azure Certificate Auto-Upload Configuration */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        Configuração de Upload Automático de Certificados
                        {m365Config.hasAzureConfig ? (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Configurado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Opcional
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Permite que certificados de agents sejam registrados automaticamente no Azure App Registration via Graph API.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="appObjectId">App Object ID</Label>
                      <Input
                        id="appObjectId"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={newAppObjectId}
                        onChange={(e) => setNewAppObjectId(e.target.value)}
                      />
                      {m365Config.appObjectId && (
                        <p className="text-xs text-green-600 font-mono">
                          Configurado: {m365Config.appObjectId.substring(0, 8)}...
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Object ID do App Registration (diferente do App ID). Encontrado em: Azure Portal → App Registrations → Seu App → Overview → Object ID
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="homeTenantId">Home Tenant ID</Label>
                      <Input
                        id="homeTenantId"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={newHomeTenantId}
                        onChange={(e) => setNewHomeTenantId(e.target.value)}
                      />
                      {m365Config.homeTenantId && (
                        <p className="text-xs text-green-600 font-mono">
                          Configurado: {m365Config.homeTenantId.substring(0, 8)}...
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Tenant ID onde o App Registration foi criado. Encontrado em: Azure Portal → Microsoft Entra ID → Overview → Tenant ID
                      </p>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg p-3 border border-border/50">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">Pré-requisito: Permissão no Azure</p>
                        <p>Para habilitar o upload automático de certificados, adicione a permissão <code className="bg-muted px-1 py-0.5 rounded">Application.ReadWrite.OwnedBy</code> no App Registration e conceda Admin Consent.</p>
                        <p>Esta permissão permite que o app adicione certificados a si mesmo sem acesso a outros apps.</p>
                      </div>
                    </div>
                  </div>
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

          <TabsContent value="modules">
            <ModulesManagement />
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            {/* Card 1: Configurações dos Agents */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Configurações dos Agents</CardTitle>
                <CardDescription>
                  Configure o comportamento global dos agents de coleta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingAgentSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="heartbeatInterval">Intervalo de Heartbeat (segundos)</Label>
                        <Input
                          id="heartbeatInterval"
                          type="number"
                          min={60}
                          max={300}
                          value={agentHeartbeatInterval}
                          onChange={(e) => setAgentHeartbeatInterval(Number(e.target.value))}
                          className="w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Define o intervalo entre check-ins dos agents. Valores menores detectam problemas 
                          mais rapidamente, mas aumentam o uso de recursos. Recomendado: 60-120 segundos.
                        </p>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <h4 className="font-medium text-sm">Sobre o Heartbeat</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                          <li>Agents reportam status e verificam tarefas pendentes a cada intervalo</li>
                          <li>Intervalos menores = detecção mais rápida de agents offline</li>
                          <li>Intervalos maiores = menor carga no servidor</li>
                          <li>A alteração afeta todos os agents na próxima sincronização</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveAgentSettings} disabled={savingAgentSettings}>
                        {savingAgentSettings ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar Configurações
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Gerenciamento de Atualizações */}
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Gerenciamento de Atualizações
                    </CardTitle>
                    <CardDescription>
                      Publique novas versões do agent para atualização automática
                    </CardDescription>
                  </div>
                  {agentLatestVersion && (
                    <Badge variant="outline" className="text-sm">
                      Versão atual: v{agentLatestVersion}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Nova Versão */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h4 className="font-medium">Publicar Nova Versão</h4>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newVersion">Versão</Label>
                      <Input
                        id="newVersion"
                        placeholder="1.1.0"
                        value={newVersion}
                        onChange={(e) => setNewVersion(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Formato semântico: major.minor.patch (ex: 1.2.0)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="agentPackageFile">Pacote (.tar.gz)</Label>
                      <Input
                        id="agentPackageFile"
                        type="file"
                        accept=".tar.gz,.gz"
                        onChange={handleFileSelect}
                      />
                      {selectedFile && (
                        <p className="text-xs text-muted-foreground">
                          Arquivo: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>

                  {calculatingChecksum && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calculando checksum...</span>
                    </div>
                  )}

                  {calculatedChecksum && !calculatingChecksum && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">SHA256:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {calculatedChecksum.substring(0, 32)}...
                      </code>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="forceUpdate"
                      checked={agentForceUpdate}
                      onCheckedChange={setAgentForceUpdate}
                    />
                    <Label htmlFor="forceUpdate" className="cursor-pointer">
                      Forçar atualização (ignorar tarefas pendentes)
                    </Label>
                  </div>

                  <Button 
                    onClick={handlePublishUpdate} 
                    disabled={!selectedFile || !newVersion || publishingUpdate || calculatingChecksum}
                    className="w-full sm:w-auto"
                  >
                    {publishingUpdate ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Publicar Atualização
                  </Button>
                </div>

                {/* Status dos Agents */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Status dos Agents</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={loadAgentStats}
                      className="h-8"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">{agentStats.upToDate} atualizados</p>
                        {agentLatestVersion && (
                          <p className="text-xs text-muted-foreground">v{agentLatestVersion}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium">{agentStats.outdated.length} desatualizados</p>
                        <p className="text-xs text-muted-foreground">Aguardando update</p>
                      </div>
                    </div>
                  </div>

                  {agentStats.outdated.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Agents desatualizados:</p>
                      <ul className="space-y-1">
                        {agentStats.outdated.map((agent, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>{agent.name}</span>
                            <Badge variant="outline" className="text-xs">v{agent.version}</Badge>
                            <span className="text-muted-foreground">- {agent.client}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {agentStats.total === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum agent registrado no sistema
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
