import { useEffect, useState, useRef } from 'react';
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
import { Loader2, Save, CheckCircle, AlertCircle, RefreshCw, Bot, Upload, AlertTriangle, Layers, Key } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ModulesManagement } from '@/components/admin/ModulesManagement';

interface ApiKeyStatus {
  name: string;
  label: string;
  description: string;
  configured: boolean;
  source: string;
  maskedValue: string;
  updatedAt: string | null;
}

export default function SettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("api-keys");
  const initialLoadDone = useRef(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
  
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
    if (user && role === 'super_admin' && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadApiKeys();
      loadAgentSettings();
      loadAgentUpdateSettings();
      loadAgentStats();
      setLoading(false);
      
      const interval = setInterval(() => {
        loadAgentStats();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user, role]);

  // ==========================================
  // API Keys Management
  // ==========================================

  const loadApiKeys = async () => {
    setLoadingApiKeys(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        method: 'GET',
      });

      if (error) throw error;
      if (data?.keys) {
        setApiKeys(data.keys);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error('Erro ao carregar chaves de API');
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const handleSaveApiKey = async (keyName: string) => {
    const value = apiKeyValues[keyName];
    if (!value?.trim()) {
      toast.error('Informe o valor da chave de API');
      return;
    }

    setSavingApiKey(keyName);
    try {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        method: 'POST',
        body: { key_name: keyName, value: value.trim() },
      });

      if (error) throw error;
      toast.success(data?.message || 'Chave salva com sucesso');
      setApiKeyValues(prev => ({ ...prev, [keyName]: '' }));
      await loadApiKeys();
    } catch (error: any) {
      console.error('Error saving API key:', error);
      toast.error('Erro ao salvar chave de API');
    } finally {
      setSavingApiKey(null);
    }
  };

  // ==========================================
  // Agent Settings
  // ==========================================

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
      const { data } = await supabase
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
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
      const versionedFilename = `iscope-agent-${newVersion}.tar.gz`;
      const { error: uploadError } = await supabase.storage
        .from('agent-releases')
        .upload(versionedFilename, selectedFile, {
          upsert: true,
          contentType: 'application/gzip'
        });

      if (uploadError) throw uploadError;

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

      const settings = [
        { key: 'agent_latest_version', value: newVersion },
        { key: 'agent_update_checksum', value: calculatedChecksum },
        { key: 'agent_force_update', value: agentForceUpdate }
      ];

      for (const setting of settings) {
        const { data: updateData, error: updateError } = await supabase
          .from('system_settings')
          .update({
            value: setting.value,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('key', setting.key)
          .select();

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
        
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações globais do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="w-4 h-4" />
              Chaves de API
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

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5" />
                      Chaves de API de Terceiros
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Gerencie as chaves de API de serviços externos usados pelo sistema.
                      Os valores são armazenados de forma encriptada.
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadApiKeys}
                    disabled={loadingApiKeys}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingApiKeys ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingApiKeys ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma chave de API configurável encontrada
                  </p>
                ) : (
                  apiKeys.map((key) => (
                    <div key={key.name} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{key.label}</h4>
                          {key.configured ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Configurada
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Não Configurada
                            </Badge>
                          )}
                          {key.configured && key.source === 'environment' && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              via variável de ambiente
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{key.description}</p>
                      
                      {key.configured && key.maskedValue && (
                        <p className="text-xs font-mono text-green-600">
                          Valor atual: {key.maskedValue}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <PasswordInput
                          placeholder={key.configured ? 'Novo valor (deixe em branco para manter)' : 'Cole a chave de API aqui'}
                          value={apiKeyValues[key.name] || ''}
                          onChange={(e) => setApiKeyValues(prev => ({ ...prev, [key.name]: e.target.value }))}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleSaveApiKey(key.name)}
                          disabled={savingApiKey === key.name || !apiKeyValues[key.name]?.trim()}
                          size="default"
                        >
                          {savingApiKey === key.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
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
