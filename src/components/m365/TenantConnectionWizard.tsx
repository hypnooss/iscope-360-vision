import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  Building, 
  Globe, 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Info,
  ExternalLink,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Client {
  id: string;
  name: string;
}

type WizardStep = 'client' | 'tenant' | 'authorize';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Globe },
  { key: 'authorize', label: 'Autorizar', icon: Shield },
];

export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user } = useAuth();
  
  const [step, setStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [authorizing, setAuthorizing] = useState(false);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tenantId, setTenantId] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [pendingTenantRecordId, setPendingTenantRecordId] = useState<string | null>(null);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset form when closing
      setStep('client');
      setSelectedClientId('');
      setTenantId('');
      setTenantDomain('');
      setAuthorizing(false);
      setPendingTenantRecordId(null);
      setWaitingForAuth(false);
      setVerifying(false);
    }
  }, [open]);

  useEffect(() => {
    if (clients.length === 1 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const canProceed = () => {
    switch (step) {
      case 'client':
        return !!selectedClientId;
      case 'tenant':
        return !!tenantId.trim();
      case 'authorize':
        return true;
      default:
        return false;
    }
  };

  const handleAuthorize = async () => {
    setAuthorizing(true);
    
    try {
      // 1. Create pending tenant record first
      const { data: tenant, error: tenantError } = await supabase
        .from('m365_tenants')
        .insert({
          client_id: selectedClientId,
          tenant_id: tenantId.trim(),
          tenant_domain: tenantDomain.trim() || null,
          connection_status: 'pending',
          created_by: user?.id,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Write initial audit log
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect_initiated',
        action_details: {
          tenant_id: tenantId.trim(),
          connection_method: 'multi_tenant_app',
        },
      });

      // 3. Get the app ID from secrets (we'll use a placeholder and the edge function will use the real one)
      // The actual app ID is stored in secrets and used by the edge function
      const appId = import.meta.env.VITE_M365_APP_ID || ''; // This will be empty in frontend, callback handles it
      
      // 4. Build the state payload for the callback
      // Use published URL to avoid cross-domain session issues
      const getAppBaseUrl = () => {
        const publishedUrl = 'https://iscope360.lovable.app';
        if (import.meta.env.DEV) {
          return window.location.origin;
        }
        return publishedUrl;
      };
      
      const statePayload = {
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        tenant_id: tenantId.trim(),
        redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
      };
      const state = btoa(JSON.stringify(statePayload));
      
      // 5. Build Admin Consent URL
      // Note: For multi-tenant apps, we need to use the /adminconsent endpoint
      // The callback URL must be registered in the Azure App Registration
      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/m365-oauth-callback`;
      
      // We need the App ID - since it's in secrets, we'll need to get it via an edge function
      // For now, we'll create a simple endpoint or use a known value
      const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });
      
      let multiTenantAppId = '';
      
      if (configError || !configData?.app_id) {
        // Fallback: Try to get from environment or show error
        console.warn('Could not get M365 app config, attempting direct consent URL');
        
        toast({
          title: 'Configuração pendente',
          description: 'O App ID do iScope 360 precisa ser configurado. Contate o administrador.',
          variant: 'destructive',
        });
        setAuthorizing(false);
        return;
      }
      
      multiTenantAppId = configData.app_id;
      
      // Build the admin consent URL
      const adminConsentUrl = new URL(`https://login.microsoftonline.com/${tenantId.trim()}/adminconsent`);
      adminConsentUrl.searchParams.set('client_id', multiTenantAppId);
      adminConsentUrl.searchParams.set('redirect_uri', callbackUrl);
      adminConsentUrl.searchParams.set('state', state);
      
      // 6. Store tenant record ID for verification
      setPendingTenantRecordId(tenant.id);
      
      // 7. Open Microsoft login in new window/tab
      window.open(
        adminConsentUrl.toString(),
        'microsoft_auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      
      // 8. Show waiting state
      setAuthorizing(false);
      setWaitingForAuth(true);
      
    } catch (error: any) {
      console.error('Error initiating authorization:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao iniciar a autorização.',
        variant: 'destructive',
      });
      setAuthorizing(false);
    }
  };

  const handleVerifyConnection = async () => {
    if (!pendingTenantRecordId) return;
    
    setVerifying(true);
    
    try {
      const { data: tenant, error } = await supabase
        .from('m365_tenants')
        .select('connection_status')
        .eq('id', pendingTenantRecordId)
        .single();
      
      if (error) throw error;
      
      if (tenant.connection_status === 'connected') {
        toast({
          title: 'Conexão estabelecida!',
          description: 'O tenant Microsoft 365 foi conectado com sucesso.',
        });
        onSuccess();
        onOpenChange(false);
      } else if (tenant.connection_status === 'partial') {
        toast({
          title: 'Conexão parcial',
          description: 'O tenant foi conectado, mas algumas permissões estão faltando.',
          variant: 'default',
        });
        onSuccess();
        onOpenChange(false);
      } else if (tenant.connection_status === 'failed') {
        toast({
          title: 'Erro na conexão',
          description: 'Ocorreu um erro durante a autorização. Tente novamente.',
          variant: 'destructive',
        });
        setWaitingForAuth(false);
        setPendingTenantRecordId(null);
      } else {
        toast({
          title: 'Aguardando autorização',
          description: 'A autorização ainda não foi concluída. Complete o processo na janela da Microsoft.',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error verifying connection:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o status da conexão.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].key);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'client':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione o Cliente</Label>
              <p className="text-sm text-muted-foreground">
                O tenant Microsoft 365 será associado a este cliente.
              </p>
            </div>
            
            {clients.length === 0 ? (
              <Card className="border-dashed border-border/50">
                <CardContent className="py-6 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente disponível. Crie um cliente primeiro.
                  </p>
                </CardContent>
              </Card>
            ) : clients.length === 1 ? (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-4 flex items-center gap-3">
                  <Building className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{clients[0].name}</p>
                    <p className="text-xs text-muted-foreground">Cliente selecionado automaticamente</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Card className="bg-muted/30 border border-border/50">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Conexão Simplificada</p>
                    <p className="mt-1">
                      O iScope 360 usa um modelo de App Multi-Tenant. O administrador do tenant 
                      apenas precisa autorizar o acesso - sem criar App Registration manualmente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'tenant':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantId">Tenant ID (Directory ID) *</Label>
              <Input
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Azure Portal → Microsoft Entra ID → Overview → Tenant ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantDomain">Domínio do Tenant (opcional)</Label>
              <Input
                id="tenantDomain"
                value={tenantDomain}
                onChange={(e) => setTenantDomain(e.target.value)}
                placeholder="contoso.onmicrosoft.com"
              />
              <p className="text-xs text-muted-foreground">
                Será detectado automaticamente durante a autorização.
              </p>
            </div>

            <Card className="bg-muted/30 border border-border/50">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Você pode encontrar o Tenant ID no Azure Portal, ou usar o domínio 
                      principal do tenant (ex: contoso.onmicrosoft.com).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'authorize':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Autorizar Acesso</Label>
              <p className="text-sm text-muted-foreground">
                {waitingForAuth 
                  ? 'Complete a autorização na janela da Microsoft e clique em verificar.'
                  : 'Clique no botão abaixo para autorizar o iScope 360 a acessar o tenant Microsoft 365.'
                }
              </p>
            </div>

            <Card className="bg-muted/30 border border-border/50">
              <CardContent className="py-4">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    {waitingForAuth ? (
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    ) : (
                      <Key className="w-7 h-7 text-primary" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium">
                      {waitingForAuth ? 'Aguardando Autorização' : 'Consentimento do Administrador'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {waitingForAuth 
                        ? 'Uma nova janela foi aberta para o login da Microsoft. Complete o processo e clique em "Verificar Conexão".'
                        : 'Uma nova janela será aberta para o login da Microsoft. Um administrador do tenant precisa autorizar o acesso.'
                      }
                    </p>
                    {waitingForAuth && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        ⏳ A propagação do Admin Consent pode levar alguns minutos. Se a verificação falhar, aguarde 2-3 minutos e tente novamente.
                      </p>
                    )}
                  </div>
                  
                  {waitingForAuth ? (
                    <div className="flex flex-col gap-2 w-full max-w-[250px]">
                      <Button 
                        onClick={handleVerifyConnection}
                        size="default"
                        disabled={verifying}
                        className="gap-2 w-full"
                      >
                        {verifying ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Verificar Conexão
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setWaitingForAuth(false);
                          setPendingTenantRecordId(null);
                        }}
                        className="gap-2"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={handleAuthorize}
                      disabled={authorizing}
                      className="gap-2"
                    >
                      {authorizing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Abrindo janela...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          Autorizar com Microsoft
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border border-border/50">
              <CardContent className="py-3">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Permissões solicitadas (somente leitura):</p>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Obrigatórias:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        User.Read.All - Ler todos os usuários
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Directory.Read.All - Ler diretório (roles, unidades)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Group.Read.All - Ler todos os grupos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Application.Read.All - Ler aplicativos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        AuditLog.Read.All - Ler logs de auditoria
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Policy.Read.All - Ler políticas de segurança
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Opcionais (requer Azure AD Premium):</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-muted-foreground" />
                        Reports.Read.All - Relatórios de MFA
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border border-border/50">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-amber-700 dark:text-amber-400">Requisitos</p>
                    <p className="mt-1">
                      O usuário que autorizar precisa ser um <strong>Administrador Global</strong> ou 
                      ter a role <strong>Privileged Role Administrator</strong> no Azure AD.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Conectar Tenant Microsoft 365
          </DialogTitle>
          <DialogDescription>
            Conecte o tenant Microsoft 365 do cliente para coletar dados via Microsoft Graph.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center py-2">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center min-w-[70px]">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && "border-primary bg-primary/10 text-primary",
                      !isActive && !isCompleted && "border-muted bg-muted/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 whitespace-nowrap",
                    isActive && "text-primary font-medium",
                    !isActive && "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "w-10 h-0.5 mx-1 mt-[-16px]",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 px-1 py-2">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {/* Actions */}
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || loading || authorizing}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          {step !== 'authorize' && (
            <Button 
              onClick={handleNext} 
              disabled={!canProceed() || loading}
              className="gap-2"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
