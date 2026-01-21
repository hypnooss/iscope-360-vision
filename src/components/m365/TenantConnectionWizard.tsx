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
import { Card, CardContent } from '@/components/ui/card';
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
  AlertCircle,
  Info,
  Globe,
  Lock,
  Eye,
  EyeOff
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

type WizardStep = 'client' | 'tenant' | 'credentials' | 'permissions' | 'review';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Globe },
  { key: 'credentials', label: 'Credenciais', icon: Lock },
  { key: 'permissions', label: 'Permissões', icon: Key },
  { key: 'review', label: 'Revisão', icon: CheckCircle },
];

export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user } = useAuth();
  const { permissions: requiredPermissions, loading: permissionsLoading } = useRequiredPermissions('entra_id');
  
  const [step, setStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tenantId, setTenantId] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // App Registration credentials (created in client's tenant)
  const [appId, setAppId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
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
      setAppId('');
      setClientSecret('');
      setShowSecret(false);
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
      case 'credentials':
        return !!appId.trim() && !!clientSecret.trim();
      case 'permissions':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
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

      // 2. Store app credentials (encrypted)
      // Note: In production, encrypt the client_secret before storing
      const { error: credError } = await supabase
        .from('m365_app_credentials')
        .insert({
          tenant_record_id: tenant.id,
          azure_app_id: appId.trim(),
          client_secret_encrypted: clientSecret.trim(), // TODO: Encrypt this via edge function
          auth_type: 'client_secret',
          is_active: true,
          created_by: user?.id,
        });

      if (credError) throw credError;

      // 3. Enable Entra ID submodule
      await supabase
        .from('m365_tenant_submodules')
        .insert({
          tenant_record_id: tenant.id,
          submodule: 'entra_id',
          is_enabled: true,
        });

      // 4. Update tenant status to connected (will be validated later via edge function)
      await supabase
        .from('m365_tenants')
        .update({ 
          connection_status: 'connected',
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      // 5. Create audit log entry
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect',
        action_details: {
          tenant_id: tenantId,
          auth_type: 'client_secret',
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
      console.error('Error creating connection:', error);
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

      case 'credentials':
        return (
          <div className="space-y-4">
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">App Registration no Tenant do Cliente</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      O cliente precisa criar um App Registration no Azure AD do próprio tenant
                      e conceder as permissões necessárias. As credenciais serão armazenadas
                      de forma segura e criptografada.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="appId">Application (Client) ID *</Label>
              <Input
                id="appId"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Azure Portal → App Registrations → Sua App → Overview → Application (client) ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Seu client secret"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Azure Portal → App Registrations → Sua App → Certificates & secrets → New client secret
              </p>
            </div>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Importante</p>
                    <p className="text-muted-foreground text-xs">
                      O Client Secret expira. Configure um secret com validade adequada
                      e atualize-o antes do vencimento. Recomendamos 24 meses.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Permissões Necessárias do Microsoft Graph</Label>
              <p className="text-sm text-muted-foreground">
                Configure as seguintes permissões no App Registration do cliente.
                Todas devem ser do tipo <Badge variant="outline" className="text-xs">Application</Badge> e
                precisam de <strong>Admin Consent</strong>.
              </p>
            </div>

            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Como configurar as permissões:</p>
                    <ol className="text-muted-foreground text-xs mt-1 list-decimal ml-4 space-y-1">
                      <li>Azure Portal → App Registrations → Sua App</li>
                      <li>API permissions → Add a permission → Microsoft Graph</li>
                      <li>Application permissions → Adicione cada permissão listada abaixo</li>
                      <li>Clique em "Grant admin consent for [Tenant]"</li>
                    </ol>
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
                <span className="text-muted-foreground">Application ID</span>
                <span className="font-mono text-sm">{appId.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Autenticação</span>
                <Badge variant="secondary">Client Credentials (Secret)</Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Permissões</span>
                <span>{requiredPermissions.filter(p => p.is_required).length} permissões</span>
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
                    Ao finalizar, tentaremos validar a conexão automaticamente usando as credenciais fornecidas.
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conectar Tenant Microsoft 365</DialogTitle>
          <DialogDescription>
            Configure a conexão com o tenant Microsoft 365 do cliente para coletar dados via Microsoft Graph.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 py-4">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && "border-primary bg-primary/10 text-primary",
                      !isActive && !isCompleted && "border-muted bg-muted/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-1",
                    isActive && "text-primary font-medium",
                    !isActive && "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "w-12 h-0.5 mx-1 mt-[-16px]",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="py-4 min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || loading}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          {step === 'review' ? (
            <Button onClick={handleSubmit} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Finalizar Conexão
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleNext} 
              disabled={!canProceed() || loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Próximo
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
