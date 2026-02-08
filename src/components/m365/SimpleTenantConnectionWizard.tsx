import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePreview } from '@/contexts/PreviewContext';
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
import { toast } from '@/hooks/use-toast';
import { 
  Building, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Info,
  Mail,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleTenantConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
}

type WizardStep = 'form' | 'authenticating' | 'result';

interface ConnectionResult {
  success: boolean;
  partial?: boolean;
  tenantRecordId?: string;
  displayName?: string;
  domain?: string;
  agentLinked?: boolean;
  missingPermissions?: string[];
  error?: string;
}

// Discover tenant ID from email domain using OpenID configuration
async function discoverTenantId(domain: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`
    );
    if (!response.ok) {
      console.warn('Could not discover tenant ID for domain:', domain);
      return null;
    }
    const data = await response.json();
    // Extract tenant ID from issuer URL: https://login.microsoftonline.com/{tenant_id}/v2.0
    const issuer = data.issuer;
    const match = issuer?.match(/https:\/\/login\.microsoftonline\.com\/([^/]+)\//);
    return match ? match[1] : null;
  } catch (err) {
    console.error('Error discovering tenant ID:', err);
    return null;
  }
}

export function SimpleTenantConnectionWizard({ 
  open, 
  onOpenChange, 
  onSuccess 
}: SimpleTenantConnectionWizardProps) {
  const { user } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();
  
  const [step, setStep] = useState<WizardStep>('form');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState('');
  
  // Auth state
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [pendingTenantRecordId, setPendingTenantRecordId] = useState<string | null>(null);
  
  // Result
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open, isPreviewMode, previewTarget]);

  useEffect(() => {
    if (!open) {
      resetWizard();
    }
  }, [open]);

  useEffect(() => {
    if (clients.length === 1 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  // Fetch agents when client is selected
  useEffect(() => {
    if (selectedClientId) {
      fetchAgents(selectedClientId);
    }
  }, [selectedClientId]);

  // Listen for messages from popup window
  useEffect(() => {
    if (!waitingForAuth) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'm365-oauth-callback') return;
      
      const { success, partial, tenantId: msgTenantId, missingPermissions, error, errorDescription } = event.data;
      
      if (success && !partial) {
        setConnectionResult({
          success: true,
          tenantRecordId: pendingTenantRecordId || undefined,
          missingPermissions: [],
        });
        setStep('result');
        setWaitingForAuth(false);
      } else if (partial) {
        setConnectionResult({
          success: true,
          partial: true,
          tenantRecordId: pendingTenantRecordId || undefined,
          missingPermissions: missingPermissions || [],
        });
        setStep('result');
        setWaitingForAuth(false);
      } else if (error) {
        setConnectionResult({
          success: false,
          error: errorDescription || error || 'Ocorreu um erro durante a autorização.',
        });
        setStep('result');
        setWaitingForAuth(false);
        setPendingTenantRecordId(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [waitingForAuth, pendingTenantRecordId]);

  const resetWizard = useCallback(() => {
    setStep('form');
    setSelectedClientId('');
    setAdminEmail('');
    setWaitingForAuth(false);
    setPendingTenantRecordId(null);
    setConnectionResult(null);
    setAgents([]);
  }, []);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      let query = supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (isPreviewMode && previewTarget?.workspaces) {
        const workspaceIds = previewTarget.workspaces.map(w => w.id);
        if (workspaceIds.length > 0) {
          query = query.in('id', workspaceIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchAgents = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, client_id')
        .eq('client_id', clientId)
        .eq('revoked', false)
        .order('name');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    }
  };

  const canStart = () => {
    return !!selectedClientId && 
           !!adminEmail.trim() && 
           adminEmail.includes('@');
  };

  const handleStart = async () => {
    if (!canStart()) return;

    setStep('authenticating');
    setWaitingForAuth(true);

    try {
      // 1. Discover tenant ID from email domain
      const emailDomain = adminEmail.split('@')[1];
      const tenantId = await discoverTenantId(emailDomain);
      
      if (!tenantId) {
        toast({
          title: "Erro",
          description: "Não foi possível descobrir o Tenant ID a partir do email. Verifique o domínio.",
          variant: "destructive",
        });
        setStep('form');
        setWaitingForAuth(false);
        return;
      }

      // 2. Create pending tenant record
      const { data: tenant, error: tenantError } = await supabase
        .from('m365_tenants')
        .insert({
          client_id: selectedClientId,
          tenant_id: tenantId,
          tenant_domain: emailDomain,
          connection_status: 'pending',
          created_by: user?.id,
        })
        .select()
        .single();

      if (tenantError) {
        console.error('Error creating tenant record:', tenantError);
        throw new Error('Erro ao criar registro do tenant.');
      }

      setPendingTenantRecordId(tenant.id);

      // 3. Link agent automatically (use first available agent for the workspace)
      if (agents.length > 0) {
        const { error: linkError } = await supabase
          .from('m365_tenant_agents')
          .insert({
            tenant_record_id: tenant.id,
            agent_id: agents[0].id,
            enabled: true,
          });

        if (linkError) {
          console.warn('Failed to auto-link agent:', linkError);
        } else {
          console.log(`Agent ${agents[0].name} auto-linked to tenant`);
        }
      }

      // 4. Write initial audit log
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect_initiated',
        action_details: {
          tenant_id: tenantId,
          connection_method: 'admin_consent_simple',
          admin_email: adminEmail,
        },
      });

      // 5. Get the app ID from edge function
      const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });

      if (configError || !configData?.app_id) {
        toast({
          title: 'Configuração pendente',
          description: 'O App ID do iScope 360 precisa ser configurado. Contate o administrador.',
          variant: 'destructive',
        });
        setStep('form');
        setWaitingForAuth(false);
        return;
      }

      const appId = configData.app_id;

      // 6. Build the state payload for the callback
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
        tenant_id: tenantId,
        redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
      };
      const state = btoa(JSON.stringify(statePayload));

      // 7. Build Admin Consent URL
      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/m365-oauth-callback`;
      
      const adminConsentUrl = new URL(`https://login.microsoftonline.com/${tenantId}/adminconsent`);
      adminConsentUrl.searchParams.set('client_id', appId);
      adminConsentUrl.searchParams.set('redirect_uri', callbackUrl);
      adminConsentUrl.searchParams.set('state', state);

      // 8. Open popup
      window.open(
        adminConsentUrl.toString(),
        'microsoft_auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

    } catch (error: any) {
      console.error('Error starting connection:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao iniciar conexão.',
        variant: "destructive",
      });
      setStep('form');
      setWaitingForAuth(false);
    }
  };

  const handleClose = () => {
    if (connectionResult?.success) {
      onSuccess();
    }
    onOpenChange(false);
  };

  const renderForm = () => (
    <div className="space-y-6">
      {/* Client Selection */}
      <div className="space-y-2">
        <Label>Workspace</Label>
        {loadingClients ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-4 text-center">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum workspace disponível.
              </p>
            </CardContent>
          </Card>
        ) : clients.length === 1 ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 flex items-center gap-3">
              <Building className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">{clients[0].name}</p>
                <p className="text-xs text-muted-foreground">Selecionado automaticamente</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o workspace" />
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
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Conta do Administrador
          </span>
        </div>
      </div>

      {/* Admin Email */}
      <div className="space-y-2">
        <Label htmlFor="adminEmail">
          <Mail className="w-4 h-4 inline mr-2" />
          Email do Administrador
        </Label>
        <Input
          id="adminEmail"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@contoso.onmicrosoft.com"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Use o email de um Global Admin para conceder permissões.
        </p>
      </div>

      {/* Info Notice */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-3">
          <div className="flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como funciona?</p>
              <ul className="text-xs space-y-1">
                <li>• Uma janela abrirá para você conceder permissões</li>
                <li>• Faça login como Global Admin do tenant</li>
                <li>• Clique em "Accept" para conceder as permissões</li>
                <li>• A conexão será estabelecida automaticamente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAuthenticating = () => (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="font-medium">Aguardando autorização...</p>
          <p className="text-sm text-muted-foreground">
            Complete o processo na janela da Microsoft
          </p>
        </div>
      </div>

      {/* Helper card */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="py-3">
          <div className="flex gap-2 items-center justify-center">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Após conceder as permissões, esta janela atualizará automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className={cn(
        "w-16 h-16 rounded-full flex items-center justify-center",
        connectionResult?.success ? "bg-green-500/10" : "bg-red-500/10"
      )}>
        {connectionResult?.success ? (
          <CheckCircle className="w-8 h-8 text-green-500" />
        ) : (
          <AlertCircle className="w-8 h-8 text-red-500" />
        )}
      </div>
      
      <div className="text-center space-y-2">
        <p className="font-medium text-lg">
          {connectionResult?.success 
            ? (connectionResult.partial ? 'Conexão Parcial' : 'Conexão Estabelecida!')
            : 'Falha na Conexão'}
        </p>
        
        {connectionResult?.success ? (
          <div className="space-y-2">
            {connectionResult.partial && connectionResult.missingPermissions && connectionResult.missingPermissions.length > 0 && (
              <div className="text-xs text-amber-600">
                <p>Algumas permissões não foram concedidas:</p>
                <ul className="mt-1">
                  {connectionResult.missingPermissions.map(p => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-green-600">
              ✓ Tenant conectado com sucesso
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-500">
            {connectionResult?.error}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Conectar Microsoft 365
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Informe o email do administrador para iniciar a conexão.'}
            {step === 'authenticating' && 'Complete a autorização na janela da Microsoft.'}
            {step === 'result' && (connectionResult?.success ? 'Tenant conectado com sucesso.' : 'Ocorreu um erro.')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'form' && renderForm()}
          {step === 'authenticating' && renderAuthenticating()}
          {step === 'result' && renderResult()}
        </div>

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleStart} 
                disabled={!canStart()}
                className="gap-2"
              >
                Continuar
              </Button>
            </>
          )}

          {step === 'authenticating' && (
            <Button 
              variant="outline" 
              onClick={() => {
                setWaitingForAuth(false);
                setStep('form');
              }}
            >
              Cancelar
            </Button>
          )}
          
          {step === 'result' && (
            <>
              {!connectionResult?.success && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setConnectionResult(null);
                    setStep('form');
                  }}
                >
                  Tentar Novamente
                </Button>
              )}
              <Button onClick={handleClose}>
                {connectionResult?.success ? 'Concluir' : 'Fechar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
