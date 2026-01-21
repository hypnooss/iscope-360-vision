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
  EyeOff,
  Copy,
  ExternalLink,
  XCircle,
  AlertTriangle
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

interface ValidationResult {
  success: boolean;
  error?: string;
  details?: string;
  step?: string;
  token_valid?: boolean;
  graph_access?: boolean;
  tenant_info?: {
    display_name: string;
    verified_domains: string[];
  };
  permissions?: Array<{
    name: string;
    granted: boolean;
    required: boolean;
  }>;
  all_permissions_granted?: boolean;
  missing_permissions?: string[];
  connection_status?: string;
}

type WizardStep = 'client' | 'tenant' | 'credentials' | 'permissions' | 'validate' | 'review';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'client', label: 'Cliente', icon: Building },
  { key: 'tenant', label: 'Tenant', icon: Globe },
  { key: 'credentials', label: 'Credenciais', icon: Lock },
  { key: 'permissions', label: 'Permissões', icon: Key },
  { key: 'validate', label: 'Validação', icon: Shield },
  { key: 'review', label: 'Revisão', icon: CheckCircle },
];

// Step-by-step instructions for creating App Registration
const APP_REGISTRATION_STEPS = [
  {
    title: '1. Acessar Azure Portal',
    description: 'Acesse portal.azure.com com uma conta de administrador do tenant.',
    path: 'Microsoft Entra ID → App registrations → New registration',
  },
  {
    title: '2. Registrar o aplicativo',
    description: 'Preencha os dados do novo App Registration.',
    details: [
      'Name: InfraScope 360 (ou nome de sua preferência)',
      'Supported account types: Accounts in this organizational directory only (Single tenant)',
      'Redirect URI: Deixe em branco (não necessário para Client Credentials)',
    ],
  },
  {
    title: '3. Copiar os IDs',
    description: 'Após criar, copie os IDs da página Overview.',
    details: [
      'Application (client) ID → Você vai usar no passo Credenciais',
      'Directory (tenant) ID → Você já informou no passo anterior',
    ],
  },
  {
    title: '4. Criar Client Secret',
    description: 'Crie uma credencial para autenticação.',
    path: 'Certificates & secrets → Client secrets → New client secret',
    details: [
      'Description: InfraScope 360 Access',
      'Expires: 24 months (recomendado)',
    ],
    warning: '⚠️ IMPORTANTE: Copie o VALUE do secret imediatamente! Ele aparece apenas uma vez. O VALUE é diferente do Secret ID.',
  },
  {
    title: '5. Configurar permissões',
    description: 'Adicione as permissões do Microsoft Graph.',
    path: 'API permissions → Add a permission → Microsoft Graph → Application permissions',
    details: [
      'User.Read.All',
      'Directory.Read.All',
      'Group.Read.All',
      'Application.Read.All',
      'AuditLog.Read.All',
    ],
  },
  {
    title: '6. Conceder Admin Consent',
    description: 'Autorize as permissões para o tenant.',
    path: 'API permissions → Grant admin consent for [Seu Tenant]',
    details: [
      'Clique em "Grant admin consent"',
      'Confirme que todas as permissões mostram status "Granted"',
    ],
  },
];

export function TenantConnectionWizard({ open, onOpenChange, onSuccess }: TenantConnectionWizardProps) {
  const { user } = useAuth();
  const { permissions: requiredPermissions, loading: permissionsLoading } = useRequiredPermissions('entra_id');
  
  const [step, setStep] = useState<WizardStep>('client');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [tenantId, setTenantId] = useState('');
  const [tenantDomain, setTenantDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // App Registration credentials
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
      setValidationResult(null);
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
      case 'credentials':
        return !!appId.trim() && !!clientSecret.trim();
      case 'permissions':
        return true;
      case 'validate':
        return validationResult?.success === true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleValidateConnection = async () => {
    setValidating(true);
    setValidationResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-m365-connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId.trim(),
            app_id: appId.trim(),
            client_secret: clientSecret.trim(),
          }),
        }
      );

      const result: ValidationResult = await response.json();
      setValidationResult(result);
      
      if (result.success) {
        // Auto-fill display name from Graph if empty
        if (!displayName && result.tenant_info?.display_name) {
          setDisplayName(result.tenant_info.display_name);
        }
        if (!tenantDomain && result.tenant_info?.verified_domains?.[0]) {
          setTenantDomain(result.tenant_info.verified_domains[0]);
        }
        
        toast({
          title: 'Conexão validada!',
          description: result.all_permissions_granted 
            ? 'Todas as permissões estão configuradas corretamente.'
            : 'Conexão OK, mas algumas permissões estão faltando.',
        });
      } else {
        toast({
          title: 'Falha na validação',
          description: result.error || 'Não foi possível validar a conexão.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationResult({
        success: false,
        error: 'Erro ao validar conexão',
        details: error.message,
      });
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao validar a conexão.',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
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
      // Clear validation when going back
      if (STEPS[prevIndex].key !== 'validate') {
        setValidationResult(null);
      }
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
          tenant_domain: tenantDomain.trim() || validationResult?.tenant_info?.verified_domains?.[0] || null,
          display_name: displayName.trim() || validationResult?.tenant_info?.display_name || null,
          connection_status: validationResult?.all_permissions_granted ? 'connected' : 'partial',
          created_by: user?.id,
          last_validated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Store app credentials
      const { error: credError } = await supabase
        .from('m365_app_credentials')
        .insert({
          tenant_record_id: tenant.id,
          azure_app_id: appId.trim(),
          client_secret_encrypted: clientSecret.trim(), // TODO: Encrypt via edge function
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

      // 4. Store permission status
      if (validationResult?.permissions) {
        for (const perm of validationResult.permissions) {
          await supabase
            .from('m365_tenant_permissions')
            .insert({
              tenant_record_id: tenant.id,
              permission_name: perm.name,
              permission_type: 'Application',
              status: perm.granted ? 'granted' : 'pending',
              granted_at: perm.granted ? new Date().toISOString() : null,
            });
        }
      }

      // 5. Create audit log entry
      await supabase.from('m365_audit_logs').insert({
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        user_id: user?.id,
        action: 'connect',
        action_details: {
          tenant_id: tenantId,
          tenant_domain: tenantDomain || validationResult?.tenant_info?.verified_domains?.[0],
          auth_type: 'client_secret',
          submodules: ['entra_id'],
          permissions_granted: validationResult?.permissions?.filter(p => p.granted).map(p => p.name) || [],
          permissions_missing: validationResult?.missing_permissions || [],
          validation_status: validationResult?.connection_status,
        },
      });

      toast({
        title: 'Tenant conectado!',
        description: validationResult?.all_permissions_granted 
          ? 'A conexão foi configurada com sucesso.'
          : 'Conexão criada, mas algumas permissões ainda precisam ser concedidas.',
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência.' });
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

            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Neste modelo, o cliente cria e gerencia o App Registration no próprio tenant Azure AD, 
                      mantendo controle total sobre permissões e credenciais.
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de Exibição (opcional)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoso Corporation"
              />
              <p className="text-xs text-muted-foreground">
                Será preenchido automaticamente durante a validação se deixado em branco.
              </p>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Info className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">App Registration no Tenant do Cliente</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      O cliente precisa criar um App Registration no Azure AD do próprio tenant.
                      Veja as instruções na aba "Permissões" do próximo passo.
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
              <Label htmlFor="clientSecret">Client Secret (VALUE) *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Seu client secret value"
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
            </div>

            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Atenção: Copie o VALUE, não o Secret ID!</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      O <strong>VALUE</strong> do Client Secret aparece apenas uma vez ao criá-lo.
                      O "Secret ID" é diferente e não funciona para autenticação.
                      Se você não copiou o VALUE, será necessário criar um novo secret.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex gap-2 items-start">
                  <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p>
                      As credenciais serão armazenadas de forma segura. Recomendamos configurar 
                      o secret com validade de 24 meses e atualizar antes do vencimento.
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
              <Label>Passo a passo: Criar App Registration</Label>
              <p className="text-sm text-muted-foreground">
                Se ainda não criou o App Registration, siga estas instruções detalhadas.
              </p>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {APP_REGISTRATION_STEPS.map((stepInfo, index) => (
                <Card key={index} className="bg-muted/30">
                  <CardContent className="py-3">
                    <div className="space-y-2">
                      <p className="font-medium text-sm">{stepInfo.title}</p>
                      <p className="text-xs text-muted-foreground">{stepInfo.description}</p>
                      
                      {stepInfo.path && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {stepInfo.path}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(stepInfo.path!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {stepInfo.details && (
                        <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-0.5">
                          {stepInfo.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                      
                      {stepInfo.warning && (
                        <div className="bg-destructive/10 text-destructive text-xs p-2 rounded mt-2">
                          {stepInfo.warning}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <span className="text-sm">Abrir Azure Portal</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', '_blank')}
                  >
                    Abrir
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="pt-2">
              <Label className="text-sm">Permissões necessárias para Entra ID:</Label>
              {permissionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PermissionsList permissions={requiredPermissions} />
              )}
            </div>
          </div>
        );

      case 'validate':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Validar Conexão</Label>
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para testar a conexão com o Microsoft Graph e validar as permissões.
              </p>
            </div>

            <div className="text-center py-4">
              <Button 
                onClick={handleValidateConnection}
                size="lg"
                disabled={validating}
                className="gap-2"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Testar Conexão
                  </>
                )}
              </Button>
            </div>

            {validationResult && (
              <div className="space-y-3">
                {validationResult.success ? (
                  <>
                    <Card className="bg-green-500/10 border-green-500/30">
                      <CardContent className="py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="font-medium text-green-700 dark:text-green-400">Conexão validada!</p>
                            <p className="text-xs text-muted-foreground">
                              Tenant: {validationResult.tenant_info?.display_name}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="py-3">
                        <Label className="text-sm mb-2 block">Status das permissões:</Label>
                        <div className="space-y-2">
                          {validationResult.permissions?.map((perm) => (
                            <div key={perm.name} className="flex items-center justify-between text-sm">
                              <span className="font-mono text-xs">{perm.name}</span>
                              {perm.granted ? (
                                <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Concedida
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-destructive/20">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Pendente
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {!validationResult.all_permissions_granted && (
                      <Card className="bg-amber-500/10 border-amber-500/30">
                        <CardContent className="py-3">
                          <div className="flex gap-2 items-start">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-700 dark:text-amber-400">Permissões faltando</p>
                              <p className="text-xs text-muted-foreground">
                                Conceda Admin Consent para: {validationResult.missing_permissions?.join(', ')}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Você pode continuar agora e atualizar as permissões depois.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="bg-destructive/10 border-destructive/30">
                    <CardContent className="py-3">
                      <div className="flex gap-2 items-start">
                        <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">{validationResult.error}</p>
                          {validationResult.details && (
                            <p className="text-xs text-muted-foreground mt-1">{validationResult.details}</p>
                          )}
                          {validationResult.step === 'token' && (
                            <div className="mt-2 text-xs space-y-1">
                              <p className="font-medium">Verifique:</p>
                              <ul className="list-disc ml-4 text-muted-foreground">
                                <li>O Tenant ID está correto</li>
                                <li>O Application (Client) ID está correto</li>
                                <li>O Client Secret VALUE foi copiado (não o Secret ID)</li>
                                <li>O Client Secret não expirou</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
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
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">
                  {validationResult?.tenant_info?.display_name || displayName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Tenant ID</span>
                <span className="font-mono text-sm">{tenantId.slice(0, 8)}...{tenantId.slice(-4)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Domínio</span>
                <span>{tenantDomain || validationResult?.tenant_info?.verified_domains?.[0] || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Application ID</span>
                <span className="font-mono text-sm">{appId.slice(0, 8)}...{appId.slice(-4)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Autenticação</span>
                <Badge variant="secondary">Client Credentials (Secret)</Badge>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Status</span>
                {validationResult?.all_permissions_granted ? (
                  <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completo
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Parcial
                  </Badge>
                )}
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
                    A conexão foi validada e está pronta para ser salva.
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
        <div className="flex items-center justify-between px-2 py-4 overflow-x-auto">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center min-w-[60px]">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors",
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
                      "w-8 h-0.5 mx-0.5 mt-[-16px]",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} 
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="py-4 min-h-[350px]">
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
                  Salvando...
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
              disabled={!canProceed() || loading || validating}
              className="gap-2"
            >
              {loading || validating ? (
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
