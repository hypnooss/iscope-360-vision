import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Terminal, 
  CheckCircle,
  Loader2,
  Clock
} from 'lucide-react';

interface ExchangeRBACSetupCardProps {
  appId: string;
  tenantRecordId: string;
  tenantDomain?: string;
  hasLinkedAgent?: boolean;
  onVerify?: () => void;
  isVerifying?: boolean;
  onSetupComplete?: () => void;
  setupStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

export function ExchangeRBACSetupCard({
  appId,
  tenantRecordId,
  tenantDomain,
  hasLinkedAgent = false,
  onVerify,
  isVerifying,
  onSetupComplete,
  setupStatus = 'pending'
}: ExchangeRBACSetupCardProps) {
  // If completed, show success state
  if (setupStatus === 'completed') {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Terminal className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-base">Exchange Online RBAC</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configuração para análises PowerShell
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Configurado
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // If running, show progress
  if (setupStatus === 'running') {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Terminal className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Exchange Online RBAC</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configuração em andamento via Agent...
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Configurando
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            O Agent está executando os comandos PowerShell para registrar o Service Principal no Exchange Online.
            Este processo pode levar alguns segundos.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Default pending state - simplified
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Terminal className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Exchange Online RBAC</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Aguardando configuração automática
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {hasLinkedAgent 
              ? 'A configuração será realizada automaticamente pelo Agent vinculado.'
              : 'Vincule um Agent ao tenant para habilitar a configuração automática.'
            }
          </p>

          {onVerify && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onVerify}
                disabled={isVerifying}
                className="gap-1.5"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verificar Status
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
