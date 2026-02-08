import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ExchangeRBACSetupCardProps {
  appId: string;
  tenantDomain?: string;
  onVerify?: () => void;
  isVerifying?: boolean;
}

export function ExchangeRBACSetupCard({
  appId,
  tenantDomain,
  onVerify,
  isVerifying
}: ExchangeRBACSetupCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Build the PowerShell commands - NOTE: User must get SP Object ID from Enterprise Applications
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
            Ação Manual
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
                <p className="font-medium text-foreground">Erro "PSGallery não confiável"?</p>
                <p className="text-xs ml-2">
                  Pressione <code className="bg-muted px-1 rounded">S</code> (Sim) ou <code className="bg-muted px-1 rounded">A</code> (Sim para Todos) para aceitar.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Após executar:</p>
                <p className="text-xs ml-2">
                  Clique em "Testar" no card do tenant para verificar se as permissões foram aplicadas.
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
                  <span className="animate-spin">⟳</span>
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
