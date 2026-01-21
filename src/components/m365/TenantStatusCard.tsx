import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Unplug,
  Clock,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TenantConnection } from '@/hooks/useTenantConnection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TenantStatusCardProps {
  tenant: TenantConnection;
  onTest: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onUpdatePermissions?: (tenantId: string) => void;
}

export function TenantStatusCard({ 
  tenant, 
  onTest, 
  onDisconnect, 
  onUpdatePermissions 
}: TenantStatusCardProps) {
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await onTest(tenant.id);
    setTesting(false);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await onDisconnect(tenant.id);
    setDisconnecting(false);
    setShowDisconnectDialog(false);
  };

  const getStatusBadge = (status: TenantConnection['connection_status']) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Parcial
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Falhou
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            <Unplug className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  return (
    <>
      <Card className="glass-card hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {tenant.display_name || tenant.tenant_domain || 'Tenant sem nome'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tenant.client.name}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(tenant.connection_status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tenant ID:</span>
              <span className="font-mono text-xs">{tenant.tenant_id.slice(0, 8)}...</span>
            </div>
            {tenant.tenant_domain && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domínio:</span>
                <span>{tenant.tenant_domain}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última validação:</span>
              <span>
                {tenant.last_validated_at 
                  ? formatDistanceToNow(new Date(tenant.last_validated_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })
                  : 'Nunca'
                }
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={handleTest}
              disabled={testing || tenant.connection_status === 'disconnected'}
            >
              {testing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Testar
            </Button>
            {onUpdatePermissions && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onUpdatePermissions(tenant.id)}
                disabled={tenant.connection_status === 'disconnected'}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDisconnectDialog(true)}
              disabled={tenant.connection_status === 'disconnected'}
            >
              <Unplug className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desconectar o tenant "{tenant.display_name || tenant.tenant_domain}"? 
              Os dados coletados serão mantidos, mas novas coletas não serão possíveis até reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disconnecting}
            >
              {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
