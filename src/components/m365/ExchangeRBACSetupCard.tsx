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
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ExchangeRBACSetupCardProps {
  appId: string;
  appObjectId?: string;
  tenantDomain?: string;
  onVerify?: () => void;
  isVerifying?: boolean;
}

export function ExchangeRBACSetupCard({
  appId,
  appObjectId,
  tenantDomain,
  onVerify,
  isVerifying
}: ExchangeRBACSetupCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Build the PowerShell commands
  const displayName = 'iScope Security';
  const objectIdPlaceholder = appObjectId || '<SP_OBJECT_ID>';
  
  const commands = `# 1. Instalar módulo Exchange Online (se necessário)
Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser

# 2. Conectar ao Exchange Online
Connect-ExchangeOnline

# 3. Registrar o Service Principal do iScope
New-ServicePrincipal -AppId "${appId}" -ObjectId "${objectIdPlaceholder}" -DisplayName "${displayName}"

# 4. Atribuir permissões de leitura de organização
New-ManagementRoleAssignment -App "${appId}" -Role "View-Only Organization Management"

# 5. Desconectar
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

  const openExchangeAdmin = () => {
    window.open('https://admin.exchange.microsoft.com/', '_blank');
  };

  const openEntraPortal = () => {
    window.open('https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AppAppsPreview', '_blank');
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
        {/* Explanation */}
        <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Por questões de segurança da Microsoft, a permissão para executar comandos PowerShell no Exchange Online 
            precisa ser configurada manualmente por um administrador. Este é um processo único que leva cerca de 2 minutos.
          </p>
        </div>

        {/* Object ID Warning */}
        {!appObjectId && (
          <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 text-sm border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-amber-700 dark:text-amber-400">
              <p className="font-medium">Object ID não encontrado</p>
              <p className="text-xs mt-1">
                O Object ID do Service Principal é necessário para o comando <code className="bg-amber-500/20 px-1 rounded">New-ServicePrincipal</code>. 
                Você pode encontrá-lo no{' '}
                <button 
                  onClick={openEntraPortal}
                  className="text-amber-600 dark:text-amber-300 underline hover:no-underline inline-flex items-center gap-0.5"
                >
                  Portal Entra <ExternalLink className="w-3 h-3" />
                </button>
                {' '}em "Aplicativos Empresariais".
              </p>
            </div>
          </div>
        )}

        {/* Commands */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Comandos PowerShell</p>
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
          <pre className="p-4 rounded-lg bg-slate-950 text-slate-50 text-xs overflow-x-auto font-mono leading-relaxed">
            <code>{commands}</code>
          </pre>
        </div>

        {/* More details */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span>Instruções detalhadas</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Pré-requisitos:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>PowerShell 5.1 ou superior (Windows) ou PowerShell Core (Mac/Linux)</li>
                  <li>Conta com privilégios de <strong>Organization Management</strong> no Exchange Online</li>
                  <li>Módulo <code className="bg-muted px-1 rounded">ExchangeOnlineManagement</code> instalado</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <p className="font-medium text-foreground">O que acontece:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>New-ServicePrincipal</strong>: Registra o aplicativo no Exchange Online</li>
                  <li><strong>New-ManagementRoleAssignment</strong>: Concede permissão de leitura de configurações</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Após executar:</p>
                <p className="ml-2">
                  Clique em "Verificar Configuração" para validar que as permissões foram aplicadas corretamente.
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={openExchangeAdmin}
            className="gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Exchange Admin Center
          </Button>
          
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
