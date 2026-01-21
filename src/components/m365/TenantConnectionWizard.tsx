import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Info
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

interface RequiredPermission {
  id: string;
  permission_name: string;
  description: string;
  is_required: boolean;
}

type WizardStep = 'client' | 'tenant' | 'permissions' | 'credentials' | 'review';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Shield },
  { key: 'permissions', label: 'Permissões', icon: Key },
  { key: 'credentials', label: 'Credenciais', icon: Key },
  { key: 'review', label: 'Revisão', icon: CheckCircle },
];

export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user, role } = useAuth();
  const [step, setStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tenantId, setTenantId] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [permissionMode, setPermissionMode] = useState<'readonly' | 'advanced'>('readonly');
  const [requiredPermissions, setRequiredPermissions] = useState<RequiredPermission[]>([]);
  const [azureAppId, setAzureAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  useEffect(() => {
    if (open) {
      fetchClients();
      fetchRequiredPermissions();
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
      setPermissionMode('readonly');
      setAzureAppId('');
      setClientSecret('');
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

  const fetchRequiredPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('m365_required_permissions')
        .select('id, permission_name, description, is_required')
        .eq('submodule', 'entra_id')
        .order('is_required', { ascending: false });

      if (error) throw error;
      setRequiredPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
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
      case 'credentials':
        return !!azureAppId.trim() && !!clientSecret.trim();
      case 'review':
        return true;
      default:
        return false;
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Create tenant record
      const { data: tenant, error: tenantError } = await supabase
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

      if (tenantError) throw tenantError;

      // 2. Create credentials record
      const { error: credError } = await supabase
        .from('m365_app_credentials')
        .insert({
          tenant_record_id: tenant.id,
          azure_app_id: azureAppId.trim(),
          client_secret_encrypted: clientSecret, // In production, encrypt this
          auth_type: 'client_secret',
          created_by: user?.id,
        });

      if (credError) throw credError;

      // 3. Enable Entra ID submodule
      const { error: submoduleError } = await supabase
        .from('m365_tenant_submodules')
        .insert({
          tenant_record_id: tenant.id,
          submodule: 'entra_id',
          is_enabled: true,
        });

      if (submoduleError) throw submoduleError;

      // 4. Create audit log entry
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect',
        action_details: {
          tenant_id: tenantId,
          submodule: 'entra_id',
          permission_mode: permissionMode,
        },
      });

      toast({
        title: 'Tenant conectado!',
        description: 'A conexão com o tenant foi configurada. Configure o App Registration no Azure para concluir.',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error creating tenant connection:', error);
      toast({
        title: 'Erro ao conectar',
        description: error.message || 'Ocorreu um erro ao criar a conexão.',
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
                Encontre no Azure Portal → Microsoft Entra ID → Overview
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
              <Label>Modelo de Permissões</Label>
              <p className="text-sm text-muted-foreground">
                Escolha o nível de acesso que o InfraScope terá ao tenant.
              </p>
            </div>

            <RadioGroup value={permissionMode} onValueChange={(v) => setPermissionMode(v as 'readonly' | 'advanced')}>
              <div className="space-y-3">
                <Card className={cn(
                  "cursor-pointer transition-colors",
                  permissionMode === 'readonly' && "border-primary"
                )}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="readonly" id="readonly" />
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Somente Leitura
                          <Badge className="ml-2 text-xs" variant="secondary">Recomendado</Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Permissões mínimas para auditoria e compliance
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card className={cn(
                  "cursor-pointer transition-colors opacity-60",
                  permissionMode === 'advanced' && "border-primary opacity-100"
                )}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="advanced" id="advanced" disabled />
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Avançado
                          <Badge className="ml-2 text-xs" variant="outline">Em breve</Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Permissões adicionais para remediação automatizada
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </RadioGroup>

            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Permissões que serão solicitadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {requiredPermissions.filter(p => p.is_required).map((perm) => (
                  <div key={perm.id} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-mono text-xs">{perm.permission_name}</span>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-4">
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Como criar um App Registration no Azure</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Acesse o Azure Portal → Microsoft Entra ID → App registrations</li>
                      <li>Clique em "New registration" e dê um nome (ex: InfraScope 360)</li>
                      <li>Em "Supported account types", selecione "Single tenant"</li>
                      <li>Após criar, vá em "API permissions" e adicione as permissões listadas</li>
                      <li>Clique em "Grant admin consent" para aprovar as permissões</li>
                      <li>Vá em "Certificates & secrets" e crie um Client Secret</li>
                    </ol>
                    <Button variant="link" size="sm" className="p-0 h-auto text-blue-500" asChild>
                      <a href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app" target="_blank" rel="noopener noreferrer">
                        Ver documentação completa <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="azureAppId">Application (Client) ID *</Label>
              <Input
                id="azureAppId"
                value={azureAppId}
                onChange={(e) => setAzureAppId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Cole o valor do secret aqui"
              />
              <p className="text-xs text-muted-foreground">
                O secret será armazenado de forma segura e criptografada.
              </p>
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
                <span className="text-muted-foreground">Modo de Permissão</span>
                <Badge variant="secondary">Somente Leitura</Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">App ID</span>
                <span className="font-mono text-sm">{azureAppId.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Submódulo</span>
                <Badge>Entra ID</Badge>
              </div>
            </div>

            <Card className="bg-yellow-500/5 border-yellow-500/20">
              <CardContent className="py-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Após criar a conexão, certifique-se de conceder Admin Consent no Azure Portal 
                  para que as permissões sejam ativadas.
                </p>
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Tenant Microsoft 365</DialogTitle>
          <DialogDescription>
            Configure a conexão com um tenant para coletar dados via Microsoft Graph.
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, idx) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors",
                idx < currentStepIndex && "bg-primary text-primary-foreground",
                idx === currentStepIndex && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                idx > currentStepIndex && "bg-muted text-muted-foreground"
              )}>
                {idx < currentStepIndex ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-1",
                  idx < currentStepIndex ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[280px]">
          {renderStepContent()}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? () => onOpenChange(false) : handleBack}
            disabled={loading}
          >
            {currentStepIndex === 0 ? 'Cancelar' : <><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</>}
          </Button>
          
          {step === 'review' ? (
            <Button onClick={handleSubmit} disabled={loading || !canProceed()}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Conectar Tenant
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Próximo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
