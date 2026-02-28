import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePreview } from '@/contexts/PreviewContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  ArrowRight,
  Building,
  Check,
  CheckCircle,
  Loader2,
  AlertCircle,
  Info,
  Mail,
  ExternalLink,
  Cloud,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  name: string;
  client_id: string | null;
}

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Workspace' },
  { id: 2, label: 'Autenticação' },
  { id: 3, label: 'Resultado' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function discoverTenantId(domain: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`
    );
    if (!response.ok) return null;
    const data = await response.json();

    const issuer = data.issuer || '';
    const tokenEndpoint = data.token_endpoint || '';

    let match = issuer.match(/https:\/\/login\.microsoftonline\.com\/([a-f0-9-]+)/i);
    if (match) return match[1];

    match = issuer.match(/https:\/\/sts\.windows\.net\/([a-f0-9-]+)/i);
    if (match) return match[1];

    match = tokenEndpoint.match(/https:\/\/login\.microsoftonline\.com\/([a-f0-9-]+)/i);
    if (match) return match[1];

    return null;
  } catch {
    return null;
  }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center w-full mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                step.id < current
                  ? 'bg-primary border-primary text-primary-foreground'
                  : step.id === current
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground bg-background'
              }`}
            >
              {step.id < current ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${
                step.id === current ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                step.id < current ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddM365TenantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPreviewMode, previewTarget } = usePreview();

  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Form
  const [selectedClientId, setSelectedClientId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // Auth state
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [pendingTenantRecordId, setPendingTenantRecordId] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchClients();
  }, [isPreviewMode, previewTarget]);

  useEffect(() => {
    if (clients.length === 1 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (selectedClientId) {
      fetchAgents(selectedClientId);
    }
  }, [selectedClientId]);

  // Listen for OAuth popup callback
  useEffect(() => {
    if (!waitingForAuth) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'm365-oauth-callback') return;

      const { success, partial, missingPermissions, error, errorDescription } = event.data;

      if (success && !partial) {
        setConnectionResult({
          success: true,
          tenantRecordId: pendingTenantRecordId || undefined,
        });
      } else if (partial) {
        setConnectionResult({
          success: true,
          partial: true,
          tenantRecordId: pendingTenantRecordId || undefined,
          missingPermissions: missingPermissions || [],
        });
      } else if (error) {
        setConnectionResult({
          success: false,
          error: errorDescription || error || 'Ocorreu um erro durante a autorização.',
        });
        setPendingTenantRecordId(null);
      }

      setStep(3);
      setWaitingForAuth(false);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [waitingForAuth, pendingTenantRecordId]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      let query = supabase.from('clients').select('id, name').order('name');
      if (isPreviewMode && previewTarget?.workspaces) {
        const ids = previewTarget.workspaces.map(w => w.id);
        if (ids.length > 0) query = query.in('id', ids);
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
    } catch {
      setAgents([]);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const canProceedStep1 = !!selectedClientId;
  const canProceedStep2 = !!adminEmail.trim() && adminEmail.includes('@');

  // ── Start OAuth ───────────────────────────────────────────────────────────

  const handleStartAuth = async () => {
    if (!canProceedStep2) return;

    setWaitingForAuth(true);

    try {
      const emailDomain = adminEmail.split('@')[1];
      const tenantId = await discoverTenantId(emailDomain);

      if (!tenantId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível descobrir o Tenant ID a partir do email.',
          variant: 'destructive',
        });
        setWaitingForAuth(false);
        return;
      }

      // Create pending tenant record
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

      if (tenantError) throw new Error('Erro ao criar registro do tenant.');
      setPendingTenantRecordId(tenant.id);

      // Auto-link first agent
      if (agents.length > 0) {
        await supabase.from('m365_tenant_agents').insert({
          tenant_record_id: tenant.id,
          agent_id: agents[0].id,
          enabled: true,
        });
      }

      // Audit log
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

      // Ensure Exchange permission
      try {
        await supabase.functions.invoke('ensure-exchange-permission');
      } catch {
        // non-blocking
      }

      // Get app ID
      const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
        body: {},
      });

      if (configError || !configData?.app_id) {
        toast({
          title: 'Configuração pendente',
          description: 'O App ID do iScope 360 precisa ser configurado.',
          variant: 'destructive',
        });
        setWaitingForAuth(false);
        return;
      }

      const appId = configData.app_id;

      const getAppBaseUrl = () => {
        const publishedUrl = 'https://iscope360.lovable.app';
        return import.meta.env.DEV ? window.location.origin : publishedUrl;
      };

      const statePayload = {
        tenant_record_id: tenant.id,
        client_id: selectedClientId,
        tenant_id: tenantId,
        redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
      };
      const state = btoa(JSON.stringify(statePayload));

      const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/m365-oauth-callback`;
      const adminConsentUrl = new URL(`https://login.microsoftonline.com/${tenantId}/adminconsent`);
      adminConsentUrl.searchParams.set('client_id', appId);
      adminConsentUrl.searchParams.set('redirect_uri', callbackUrl);
      adminConsentUrl.searchParams.set('state', state);

      window.open(
        adminConsentUrl.toString(),
        'microsoft_auth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
    } catch (error: any) {
      console.error('Error starting connection:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao iniciar conexão.',
        variant: 'destructive',
      });
      setWaitingForAuth(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 2) {
      handleStartAuth();
    } else if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 2 && !waitingForAuth) {
      setStep(1);
    }
  };

  const handleFinish = () => {
    if (connectionResult?.success) {
      navigate('/scope-m365/tenant-connection');
    } else {
      // Retry
      setConnectionResult(null);
      setStep(2);
    }
  };

  // ── Render Steps ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Workspace</Label>
        {loadingClients ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-6 text-center">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum workspace disponível.</p>
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

      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-3">
          <div className="flex gap-2 items-start">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              O tenant Microsoft 365 será vinculado a este workspace. Certifique-se de selecionar o workspace correto.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep2 = () => {
    if (waitingForAuth) {
      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium">Aguardando autorização...</p>
              <p className="text-sm text-muted-foreground">
                Complete o processo na janela da Microsoft
              </p>
            </div>
          </div>
          <Card className="bg-muted/30 border-muted">
            <CardContent className="py-3">
              <div className="flex gap-2 items-center justify-center">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Após conceder as permissões, esta página atualizará automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
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
  };

  const renderStep3 = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center',
          connectionResult?.success ? 'bg-green-500/10' : 'bg-red-500/10'
        )}
      >
        {connectionResult?.success ? (
          <CheckCircle className="w-8 h-8 text-green-500" />
        ) : (
          <AlertCircle className="w-8 h-8 text-red-500" />
        )}
      </div>

      <div className="text-center space-y-2">
        <p className="font-medium text-lg">
          {connectionResult?.success
            ? connectionResult.partial
              ? 'Conexão Parcial'
              : 'Conexão Estabelecida!'
            : 'Falha na Conexão'}
        </p>

        {connectionResult?.success ? (
          <div className="space-y-2">
            {connectionResult.partial && connectionResult.missingPermissions?.length ? (
              <div className="text-xs text-amber-600">
                <p>Algumas permissões não foram concedidas:</p>
                <ul className="mt-1">
                  {connectionResult.missingPermissions.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-green-600">✓ Tenant conectado com sucesso</p>
          </div>
        ) : (
          <p className="text-sm text-red-500">{connectionResult?.error}</p>
        )}
      </div>
    </div>
  );

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb
          items={[
            { label: 'Ambiente', href: '/environment' },
            { label: 'Novo Item', href: '/environment/new' },
            { label: 'Microsoft 365' },
          ]}
        />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/environment/new')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" />
              Conectar Microsoft 365
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure a conexão com seu tenant Microsoft 365
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <StepIndicator current={step} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {step === 1 && 'Selecione o Workspace'}
                {step === 2 && (waitingForAuth ? 'Aguardando Autorização' : 'Conta do Administrador')}
                {step === 3 && 'Resultado da Conexão'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </CardContent>
          </Card>

          {/* Footer buttons */}
          <div className="flex justify-between mt-6">
            <div>
              {step === 1 && (
                <Button variant="outline" onClick={() => navigate('/environment/new')}>
                  Cancelar
                </Button>
              )}
              {step === 2 && !waitingForAuth && (
                <Button variant="outline" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
              {step === 2 && waitingForAuth && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setWaitingForAuth(false);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
            <div>
              {step === 1 && (
                <Button onClick={handleNext} disabled={!canProceedStep1} className="gap-2">
                  Próximo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {step === 2 && !waitingForAuth && (
                <Button onClick={handleNext} disabled={!canProceedStep2} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Conectar
                </Button>
              )}
              {step === 3 && (
                <Button onClick={handleFinish} className="gap-2">
                  {connectionResult?.success ? (
                    <>
                      Concluir
                      <Check className="w-4 h-4" />
                    </>
                  ) : (
                    'Tentar Novamente'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
