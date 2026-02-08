import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Bot,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRBACSetupCardProps {
  appId: string;
  tenantRecordId: string;
  tenantDomain?: string;
  hasLinkedAgent?: boolean;
  onVerify?: () => void;
  isVerifying?: boolean;
  onSetupComplete?: () => void;
}

export function ExchangeRBACSetupCard({
  appId,
  tenantRecordId,
  tenantDomain,
  hasLinkedAgent = false,
  onVerify,
  isVerifying,
  onSetupComplete
}: ExchangeRBACSetupCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(hasLinkedAgent ? 'automatic' : 'manual');
  
  // Automatic setup form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [spObjectId, setSpObjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build the PowerShell commands
  const displayName = 'iScope Security';
  
  const commands = `# =====================================================
# PASSO 1: Obter o Object ID do Service Principal
# =====================================================
# No Portal Azure, vá em:
# Enterprise Applications > Pesquise "${appId}" > Overview > Object ID
# IMPORTANTE: NÃO use o Object ID de "App Registrations" - são diferentes!

# =====================================================
# PASSO 2: Executar os comandos abaixo
# =====================================================

# Instalar módulo Exchange Online (responda 'S' quando solicitado)
Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser -Force

# Conectar ao Exchange Online (abrirá janela de login)
Connect-ExchangeOnline

# Registrar o Service Principal - SUBSTITUA <SP_OBJECT_ID> pelo Object ID obtido no Passo 1
New-ServicePrincipal -AppId "${appId}" -ObjectId "<SP_OBJECT_ID>" -DisplayName "${displayName}"

# Atribuir role de leitura (Exchange Recipient Administrator permite leitura)
New-ManagementRoleAssignment -App "${appId}" -Role "Exchange Recipient Administrator"

# Desconectar
Disconnect-ExchangeOnline -Confirm:$false`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied(true);
      toast.success('Comandos copiados para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar comandos');
    }
  };

  const openEnterpriseApps = () => {
    window.open(`https://portal.azure.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AppAppsPreview/menuId~/null/resourceId//query/${encodeURIComponent(appId)}`, '_blank');
  };

  const handleAutomaticSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminEmail || !adminPassword || !spObjectId) {
      toast.error('Preencha todos os campos');
      return;
    }

    // Validate email format
    if (!adminEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    // Validate SP Object ID format (should be a GUID)
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(spObjectId)) {
      toast.error('Object ID inválido. Deve ser um GUID (ex: 12345678-1234-1234-1234-123456789abc)');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-exchange-rbac', {
        body: {
          tenantRecordId,
          adminEmail,
          adminPassword,
          appId,
          spObjectId,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        if (data.code === 'NO_AGENT_LINKED') {
          toast.error('Nenhum agente vinculado', {
            description: 'Vincule um agente ao tenant antes de usar a configuração automática.',
          });
        } else if (data.code === 'AGENT_OFFLINE') {
          toast.error('Agente offline', {
            description: 'O agente vinculado está offline. Verifique se está em execução.',
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      toast.success('Configuração iniciada!', {
        description: `Task criada para o agente ${data.agentName}. Aguarde alguns segundos e clique em Verificar.`,
      });

      // Clear form
      setAdminEmail('');
      setAdminPassword('');
      setSpObjectId('');
      
      onSetupComplete?.();

    } catch (error: any) {
      console.error('Error setting up Exchange RBAC:', error);
      toast.error('Erro ao configurar', {
        description: error.message || 'Não foi possível criar a task de configuração.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Terminal className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Configuração do Exchange Online RBAC</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configuração necessária para análises via PowerShell
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Critical Warning */}
        <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 text-sm border border-destructive/20">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-destructive">
            <p className="font-medium">Atenção: Object ID correto é crucial!</p>
            <p className="text-xs mt-1">
              Você deve usar o <strong>Object ID da Enterprise Application</strong> (Service Principal), 
              NÃO o Object ID do App Registration. São valores diferentes!
            </p>
          </div>
        </div>

        {/* Tabs for Automatic vs Manual */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automatic" disabled={!hasLinkedAgent}>
              <Bot className="w-4 h-4 mr-2" />
              Automático
            </TabsTrigger>
            <TabsTrigger value="manual">
              <User className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Automatic Setup Tab */}
          <TabsContent value="automatic" className="space-y-4 pt-4">
            {!hasLinkedAgent ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Vincule um agente ao tenant para usar a configuração automática.</p>
              </div>
            ) : (
              <form onSubmit={handleAutomaticSetup} className="space-y-4">
                <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 text-sm border border-blue-500/20">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-blue-600 text-xs">
                    O agente executará os comandos PowerShell automaticamente. 
                    As credenciais são usadas uma única vez e não são armazenadas.
                  </div>
                </div>

                {/* Step 1: Get SP Object ID */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    1. Object ID do Service Principal
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 6104db4c-fd2c-4faf-bd6a-e43f388ecf98"
                      value={spObjectId}
                      onChange={(e) => setSpObjectId(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={openEnterpriseApps}
                      title="Abrir Enterprise Applications"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Encontre em Azure Portal &gt; Enterprise Applications &gt; Busque por "{appId}" &gt; Object ID
                  </p>
                </div>

                {/* Step 2: Admin Credentials */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    2. Credenciais do Global Admin
                  </Label>
                  <Input
                    type="email"
                    placeholder="admin@contoso.onmicrosoft.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                  <PasswordInput
                    placeholder="Senha do admin"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deve ser um Global Admin ou Exchange Admin do tenant.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting || !adminEmail || !adminPassword || !spObjectId}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4 mr-2" />
                      Configurar Automaticamente
                    </>
                  )}
                </Button>
              </form>
            )}
          </TabsContent>

          {/* Manual Setup Tab */}
          <TabsContent value="manual" className="space-y-4 pt-4">
            {/* Step 1: Get the SP Object ID */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Passo 1: Obter o Object ID correto</p>
              <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-muted-foreground space-y-2">
                  <p>1. Clique no botão abaixo para abrir o Portal Azure</p>
                  <p>2. Procure pelo app com ID: <code className="bg-muted px-1 rounded">{appId}</code></p>
                  <p>3. Copie o <strong>Object ID</strong> da página Overview</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openEnterpriseApps}
                className="gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir Enterprise Applications
              </Button>
            </div>

            {/* Commands */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Passo 2: Executar no PowerShell</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-50 text-xs overflow-x-auto font-mono leading-relaxed max-h-80 overflow-y-auto">
                <code>{commands}</code>
              </pre>
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Lembre-se de substituir <code className="bg-amber-500/20 px-1 rounded">&lt;SP_OBJECT_ID&gt;</code> pelo Object ID real obtido no Passo 1!
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* More details */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span>Dúvidas frequentes</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Qual a diferença entre os Object IDs?</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                  <li><strong>App Registration Object ID</strong>: Identifica o registro do app (definição)</li>
                  <li><strong>Enterprise Application Object ID</strong>: Identifica o Service Principal (instância no tenant)</li>
                  <li>O Exchange Online precisa do segundo (Service Principal)</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <p className="font-medium text-foreground">Por que preciso de credenciais de admin?</p>
                <p className="text-xs ml-2">
                  O registro do Service Principal no Exchange requer um usuário com a role "Organization Management" 
                  (geralmente Global Admin ou Exchange Admin). Esta é uma configuração única.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Minhas credenciais são seguras?</p>
                <p className="text-xs ml-2">
                  Sim. As credenciais são usadas uma única vez pelo agente para executar os comandos PowerShell 
                  e nunca são armazenadas em nenhum lugar. A conexão é feita diretamente entre o agente e o Exchange Online.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          {onVerify && (
            <Button
              size="sm"
              onClick={onVerify}
              disabled={isVerifying}
              className="gap-1.5 ml-auto"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Verificar Configuração
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
