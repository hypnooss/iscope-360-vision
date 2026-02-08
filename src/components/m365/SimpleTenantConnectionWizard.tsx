import { useState, useEffect } from 'react';
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
import { PasswordInput } from '@/components/ui/password-input';
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
  Lock,
  Mail
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

type WizardStep = 'form' | 'connecting' | 'result';

interface ConnectionResult {
  success: boolean;
  tenantRecordId?: string;
  displayName?: string;
  domain?: string;
  agentLinked?: boolean;
  error?: string;
}

export function SimpleTenantConnectionWizard({ 
  open, 
  onOpenChange, 
  onSuccess 
}: SimpleTenantConnectionWizardProps) {
  const { isPreviewMode, previewTarget } = usePreview();
  
  const [step, setStep] = useState<WizardStep>('form');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  
  // Form data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Result
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open, isPreviewMode, previewTarget]);

  useEffect(() => {
    if (!open) {
      // Reset form when closing
      setStep('form');
      setSelectedClientId('');
      setAdminEmail('');
      setAdminPassword('');
      setConnectionResult(null);
    }
  }, [open]);

  useEffect(() => {
    // Auto-select if only one client
    if (clients.length === 1 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      let query = supabase
        .from('clients')
        .select('id, name')
        .order('name');

      // Apply workspace filter if in preview mode
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

  const canConnect = () => {
    return !!selectedClientId && 
           !!adminEmail.trim() && 
           adminEmail.includes('@') && 
           !!adminPassword.trim();
  };

  const handleConnect = async () => {
    if (!canConnect()) return;

    setStep('connecting');
    
    try {
      const { data, error } = await supabase.functions.invoke('connect-m365-tenant', {
        body: {
          workspaceId: selectedClientId,
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        setConnectionResult({
          success: false,
          error: data.error,
        });
        setStep('result');
        return;
      }

      setConnectionResult({
        success: true,
        tenantRecordId: data.tenantRecordId,
        displayName: data.displayName,
        domain: data.domain,
        agentLinked: data.agentLinked,
      });
      setStep('result');
      
    } catch (error: any) {
      console.error('Error connecting tenant:', error);
      setConnectionResult({
        success: false,
        error: error.message || 'Erro ao conectar o tenant.',
      });
      setStep('result');
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
            Credenciais do Administrador
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
          O Tenant ID será detectado automaticamente pelo domínio do email.
        </p>
      </div>

      {/* Admin Password */}
      <div className="space-y-2">
        <Label htmlFor="adminPassword">
          <Lock className="w-4 h-4 inline mr-2" />
          Senha
        </Label>
        <PasswordInput
          id="adminPassword"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="off"
        />
      </div>

      {/* Security Notice */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-3">
          <div className="flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Segurança</p>
              <ul className="text-xs space-y-1">
                <li>• Use credenciais de <strong>Global Admin</strong> ou <strong>Exchange Admin</strong></li>
                <li>• A senha é usada uma única vez e <strong>nunca é armazenada</strong></li>
                <li>• A conta não pode ter MFA habilitado (use uma conta de serviço)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderConnecting = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="font-medium">Conectando ao Microsoft 365...</p>
        <p className="text-sm text-muted-foreground">
          Validando credenciais e configurando acesso
        </p>
      </div>
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
          {connectionResult?.success ? 'Conexão Estabelecida!' : 'Falha na Conexão'}
        </p>
        
        {connectionResult?.success ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>{connectionResult.displayName}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              {connectionResult.domain}
            </p>
            {connectionResult.agentLinked && (
              <p className="text-xs text-green-600">
                ✓ Agent vinculado automaticamente
              </p>
            )}
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
            {step === 'form' && 'Informe as credenciais de um administrador do tenant.'}
            {step === 'connecting' && 'Aguarde enquanto estabelecemos a conexão...'}
            {step === 'result' && (connectionResult?.success ? 'Tenant conectado com sucesso.' : 'Ocorreu um erro.')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'form' && renderForm()}
          {step === 'connecting' && renderConnecting()}
          {step === 'result' && renderResult()}
        </div>

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConnect} 
                disabled={!canConnect()}
                className="gap-2"
              >
                <Lock className="w-4 h-4" />
                Conectar
              </Button>
            </>
          )}
          
          {step === 'result' && (
            <>
              {!connectionResult?.success && (
                <Button 
                  variant="outline" 
                  onClick={() => setStep('form')}
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
