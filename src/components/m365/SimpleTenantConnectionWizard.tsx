import { useState, useEffect, useRef, useCallback } from 'react';
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
  Copy,
  ExternalLink,
  Clock
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

type WizardStep = 'form' | 'authenticating' | 'connecting' | 'result';

interface ConnectionResult {
  success: boolean;
  tenantRecordId?: string;
  displayName?: string;
  domain?: string;
  agentLinked?: boolean;
  error?: string;
}

interface DeviceCodeData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  tenantId: string;
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
  
  // Device Code data
  const [deviceCodeData, setDeviceCodeData] = useState<DeviceCodeData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const expirationRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Timer countdown
  useEffect(() => {
    if (step === 'authenticating' && timeRemaining > 0) {
      expirationRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    }
    
    if (timeRemaining === 0 && step === 'authenticating') {
      stopPolling();
      setConnectionResult({
        success: false,
        error: 'Tempo de autenticação expirado. Tente novamente.',
      });
      setStep('result');
    }

    return () => {
      if (expirationRef.current) {
        clearTimeout(expirationRef.current);
      }
    };
  }, [step, timeRemaining]);

  const resetWizard = () => {
    stopPolling();
    setStep('form');
    setSelectedClientId('');
    setAdminEmail('');
    setDeviceCodeData(null);
    setTimeRemaining(0);
    setCopied(false);
    setConnectionResult(null);
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (expirationRef.current) {
      clearTimeout(expirationRef.current);
      expirationRef.current = null;
    }
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

  const canStart = () => {
    return !!selectedClientId && 
           !!adminEmail.trim() && 
           adminEmail.includes('@');
  };

  const handleStart = async () => {
    if (!canStart()) return;

    try {
      const { data, error } = await supabase.functions.invoke('connect-m365-tenant', {
        body: {
          action: 'start',
          workspaceId: selectedClientId,
          adminEmail: adminEmail.trim(),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Start authentication step
      setDeviceCodeData({
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in,
        interval: data.interval,
        tenantId: data.tenantId,
      });
      setTimeRemaining(data.expires_in);
      setStep('authenticating');

      // Start polling
      startPolling(data.device_code, data.tenantId, data.interval);

    } catch (error: any) {
      console.error('Error starting connection:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao iniciar conexão.',
        variant: "destructive",
      });
    }
  };

  const startPolling = (deviceCode: string, tenantId: string, interval: number) => {
    const pollInterval = Math.max(interval, 5) * 1000; // At least 5 seconds

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('connect-m365-tenant', {
          body: {
            action: 'poll',
            deviceCode: deviceCode,
            tenantId: tenantId,
            workspaceId: selectedClientId,
          },
        });

        if (error) {
          console.error('Poll error:', error);
          return;
        }

        if (data.pending) {
          // Still waiting for user
          return;
        }

        if (data.expired || data.error) {
          stopPolling();
          setConnectionResult({
            success: false,
            error: data.error || 'Autenticação expirada.',
          });
          setStep('result');
          return;
        }

        if (data.success) {
          stopPolling();
          setConnectionResult({
            success: true,
            tenantRecordId: data.tenantRecordId,
            displayName: data.displayName,
            domain: data.domain,
            agentLinked: data.agentLinked,
          });
          setStep('result');
        }

      } catch (err) {
        console.error('Polling error:', err);
      }
    }, pollInterval);
  };

  const handleCopyCode = async () => {
    if (deviceCodeData?.user_code) {
      await navigator.clipboard.writeText(deviceCodeData.user_code);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole o código na página da Microsoft.",
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenLink = () => {
    if (deviceCodeData?.verification_uri) {
      window.open(deviceCodeData.verification_uri, '_blank');
    }
  };

  const handleClose = () => {
    stopPolling();
    if (connectionResult?.success) {
      onSuccess();
    }
    onOpenChange(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          Use o email de um Global Admin, Exchange Admin ou Security Admin.
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
                <li>• Você receberá um código para autenticar</li>
                <li>• Acesse microsoft.com/devicelogin e digite o código</li>
                <li>• Autentique-se com sua conta (MFA suportado!)</li>
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
      {/* Code Display */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-6 text-center space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Acesse o link abaixo e digite o código:
            </p>
            <div className="bg-background rounded-lg p-4 border border-border/50 inline-block">
              <p className="text-3xl font-mono font-bold tracking-wider text-primary">
                {deviceCodeData?.user_code}
              </p>
            </div>
          </div>
          
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copiado!' : 'Copiar código'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleOpenLink}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir microsoft.com/devicelogin
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timer and Status */}
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Aguardando autenticação...</span>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Instructions */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            Após fazer login no link acima (incluindo MFA, se habilitado), 
            esta tela atualizará automaticamente.
          </p>
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
        <p className="font-medium">Finalizando conexão...</p>
        <p className="text-sm text-muted-foreground">
          Configurando o tenant e permissões
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
            {step === 'form' && 'Informe o email do administrador para iniciar a conexão.'}
            {step === 'authenticating' && 'Autentique-se no link abaixo para continuar.'}
            {step === 'connecting' && 'Finalizando configuração...'}
            {step === 'result' && (connectionResult?.success ? 'Tenant conectado com sucesso.' : 'Ocorreu um erro.')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'form' && renderForm()}
          {step === 'authenticating' && renderAuthenticating()}
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
                stopPolling();
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
                    setDeviceCodeData(null);
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
