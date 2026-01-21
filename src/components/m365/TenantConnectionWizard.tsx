import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRequiredPermissions } from '@/hooks/useTenantConnection';
import { PermissionsList } from './PermissionsList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Building, 
  Key, 
  Shield, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  ExternalLink,
  AlertCircle,
  Info,
  Globe
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

type WizardStep = 'client' | 'tenant' | 'permissions' | 'consent' | 'review';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Globe },
  { key: 'permissions', label: 'Permissões', icon: Key },
  { key: 'consent', label: 'Consentimento', icon: Shield },
  { key: 'review', label: 'Revisão', icon: CheckCircle },
];

// These would come from environment variables or config
const INFRASCOPE_APP_ID = 'YOUR_MULTI_TENANT_APP_ID'; // InfraScope's multi-tenant app ID

export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user } = useAuth();
  const { permissions: requiredPermissions, loading: permissionsLoading } = useRequiredPermissions('entra_id');
  
  const [step, setStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tenantId, setTenantId] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  
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
      setDisplayName('');
      setConsentCompleted(false);
      setPendingTenantId(null);
    }
  }, [open]);

  // Auto-select client if only one
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
      case 'permissions':
        return true;
      case 'consent':
        return consentCompleted;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    const nextIndex = currentStepIndex + 1;
    
    // When moving to consent step, create the pending tenant record
    if (step === 'permissions' && !pendingTenantId) {
      setLoading(true);
      try {
        const { data: tenant, error } = await supabase
          .from('m365_tenants')
          .insert({
            client_id: selectedClientId,
            tenant_id: tenantId.trim(),
            tenant_domain: tenantDomain.trim() || null,
            display_name: displayName.trim() || null,
            connection_status: 'pending',
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        setPendingTenantId(tenant.id);
        
        // Enable Entra ID submodule
        await supabase
          .from('m365_tenant_submodules')
          .insert({
            tenant_record_id: tenant.id,
            submodule: 'entra_id',
            is_enabled: true,
          });

      } catch (error: any) {
        toast({
          title: 'Erro ao criar registro',
          description: error.message || 'Não foi possível criar o registro do tenant.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
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

  const generateAdminConsentUrl = () => {
    // Build the list of permissions for the consent URL
    const scopes = requiredPermissions
      .filter(p => p.is_required)
      .map(p => `https://graph.microsoft.com/.default`)
      .join(' ');

    // Admin consent URL for multi-tenant apps
    const baseUrl = 'https://login.microsoftonline.com';
    const tenant = tenantId.trim() || 'common';
    
    // Construct admin consent URL
    const consentUrl = new URL(`${baseUrl}/${tenant}/adminconsent`);
    consentUrl.searchParams.set('client_id', INFRASCOPE_APP_ID);
    consentUrl.searchParams.set('redirect_uri', `${window.location.origin}/m365/callback`);
    consentUrl.searchParams.set('state', pendingTenantId || '');
    
    return consentUrl.toString();
  };

  const handleAdminConsent = () => {
    const consentUrl = generateAdminConsentUrl();
    
    // Open in new window for consent flow
    const consentWindow = window.open(consentUrl, '_blank', 'width=600,height=700');
    
    // In a real implementation, you'd listen for the callback
    // For now, we'll simulate the consent completion
    toast({
      title: 'Consentimento Admin',
      description: 'Complete o consentimento na janela aberta. Após aprovar, retorne aqui.',
    });
    
    // For demo purposes, show button to confirm consent was completed
    // In production, this would be handled via the OAuth callback
  };

  const handleSubmit = async () => {
    if (!pendingTenantId) return;
    
    setLoading(true);
    try {
      // Update tenant status to connected
      const { error: updateError } = await supabase
        .from('m365_tenants')
        .update({ 
          connection_status: 'connected',
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', pendingTenantId);

      if (updateError) throw updateError;

      // Create audit log entry
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: pendingTenantId,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect',
        action_details: {
          tenant_id: tenantId,
          consent_method: 'admin_consent',
          submodules: ['entra_id'],
          permissions_requested: requiredPermissions.filter(p => p.is_required).map(p => p.permission_name),
        },
      });

      toast({
        title: 'Tenant conectado!',
        description: 'A conexão com o tenant foi configurada com sucesso.',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error finalizing connection:', error);
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Ocorreu um erro ao finalizar a conexão.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
                O tenant será associado a este cliente para organização e controle de acesso.
              </p>
            </div>
            
            {clients.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-6 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente disponível. Crie um cliente primeiro.
                  </p>
                </CardContent>
              </Card>
            ) : clients.length === 1 ? (
              <Card className="border-primary">
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
                Encontre no Azure Portal → Microsoft Entra ID → Overview → Tenant ID
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de Exibição (opcional)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoso Corporation"
              />
            </div>
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Permissões do Microsoft Graph</Label>
              <p className="text-sm text-muted-foreground">
                O InfraScope 360 solicitará as seguintes permissões para acessar dados do Entra ID.
                Todas são do tipo <Badge variant="outline" className="text-xs">Application</Badge> (somente leitura).
              </p>
            </div>

            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">App Multi-Tenant</p>
                    <p className="text-muted-foreground text-xs">
                      Você não precisa criar um App Registration. O InfraScope 360 utiliza 
                      um aplicativo próprio registrado na Microsoft. Basta conceder 
                      consentimento de administrador.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PermissionsList permissions={requiredPermissions} />
            )}
          </div>
        );

      case 'consent':
        return (
          <div className="space-y-4">
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="py-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Consentimento de Administrador Necessário</p>
                    <p className="text-sm text-muted-foreground">
                      Um usuário com função <strong>Global Administrator</strong> ou{' '}
                      <strong>Privileged Role Administrator</strong> do tenant precisa 
                      autorizar o acesso do InfraScope 360.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="text-center py-4">
                <Button 
                  onClick={handleAdminConsent}
                  size="lg"
                  className="gap-2"
                  disabled={!pendingTenantId}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Consentimento Admin
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Abrirá uma nova janela para login e consentimento
                </p>
              </div>

              <Card className="border-dashed">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="consentComplete"
                      checked={consentCompleted}
                      onChange={(e) => setConsentCompleted(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="consentComplete" className="text-sm">
                      Confirmo que completei o consentimento de administrador no portal da Microsoft
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'review':
        const selectedClient = clients.find(c => c.id === selectedClientId);
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise as informações antes de finalizar a conexão.
            </p>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{selectedClient?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Tenant ID</span>
                <span className="font-mono text-sm">{tenantId.slice(0, 8)}...</span>
              </div>
              {tenantDomain && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Domínio</span>
                  <span>{tenantDomain}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Permissões</span>
                <span>{requiredPermissions.filter(p => p.is_required).length} permissões</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Autenticação</span>
                <Badge variant="secondary">Admin Consent (App Multi-Tenant)</Badge>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Submódulo inicial</span>
                <Badge>Entra ID</Badge>
              </div>
            </div>

            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-center">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-sm">
                    Após a conexão, você poderá ativar submódulos adicionais (Exchange, SharePoint, etc.) 
                    solicitando apenas as permissões extras necessárias.
                  </p>
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conectar Tenant Microsoft 365</DialogTitle>
          <DialogDescription>
            Configure a conexão com um tenant para utilizar os submódulos do Microsoft 365.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, index) => (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors',
                  index < currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-1',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">{renderStepContent()}</div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || loading}
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {step === 'review' ? (
            <Button onClick={handleSubmit} disabled={loading} className="gap-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Finalizar Conexão
            </Button>
          ) : (
            <Button 
              onClick={handleNext} 
              disabled={!canProceed() || loading}
              className="gap-1"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
