import { useState, useEffect } from 'react';
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
  ExternalLink,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TenantConnection, TenantPermission } from '@/hooks/useTenantConnection';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TenantStatusCardProps {
  tenant: TenantConnection;
  onTest: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onUpdatePermissions?: (tenantId: string) => void;
  onEdit?: (tenantId: string) => void;
}

export function TenantStatusCard({ 
  tenant, 
  onTest, 
  onDisconnect,
  onDelete,
  onUpdatePermissions,
  onEdit
}: TenantStatusCardProps) {
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [permissions, setPermissions] = useState<TenantPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  // Fetch permissions when card loads or after test
  const fetchPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from('m365_tenant_permissions')
        .select('id, tenant_record_id, permission_name, permission_type, status, granted_at, error_reason')
        .eq('tenant_record_id', tenant.id)
        .order('permission_name');

      if (!error && data) {
        setPermissions(data as TenantPermission[]);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    // Auto-fetch permissions if tenant is connected or partial
    if (tenant.connection_status === 'connected' || tenant.connection_status === 'partial') {
      fetchPermissions();
    }
  }, [tenant.id, tenant.connection_status]);

  const handleTest = async () => {
    setTesting(true);
    await onTest(tenant.id);
    // Refresh permissions after testing
    await fetchPermissions();
    setTesting(false);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await onDisconnect(tenant.id);
    setDisconnecting(false);
    setShowDisconnectDialog(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(tenant.id);
    setDeleting(false);
    setShowDeleteDialog(false);
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

  // Separate permissions into required (all current ones are required)
  const requiredPermissions = permissions.filter(p => p.permission_type === 'Application');
  const grantedCount = permissions.filter(p => p.status === 'granted').length;
  const totalCount = permissions.length;

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

          {/* Permissions Section */}
          {permissions.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <button
                onClick={() => setShowPermissions(!showPermissions)}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  Permissões ({grantedCount}/{totalCount})
                  {loadingPermissions && <Loader2 className="w-3 h-3 animate-spin" />}
                </span>
                {showPermissions ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showPermissions && (
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Permissões do Microsoft Graph</p>
                    <div className="space-y-1">
                      {requiredPermissions.map((perm) => (
                        <div key={perm.id} className="flex items-center gap-2 text-xs">
                          <span 
                            className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              perm.status === 'granted' ? 'bg-green-500' : 
                              perm.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                            )}
                          />
                          <span className="truncate flex-1">{perm.permission_name}</span>
                          <span className="text-muted-foreground ml-auto flex items-center gap-1">
                            {perm.status === 'granted' ? (
                              'OK'
                            ) : perm.status === 'denied' ? (
                              'Negada'
                            ) : perm.error_reason ? (
                              <span className="text-amber-500" title={perm.error_reason}>
                                {perm.error_reason.length > 25 
                                  ? perm.error_reason.slice(0, 25) + '...' 
                                  : perm.error_reason}
                              </span>
                            ) : (
                              'Pendente'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEdit(tenant.id)}
                title="Editar tenant"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {onUpdatePermissions && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onUpdatePermissions(tenant.id)}
                disabled={tenant.connection_status === 'disconnected'}
                title="Atualizar permissões (Admin Consent)"
                className="gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="sr-only sm:not-sr-only sm:inline text-xs">Upgrade</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-border"
              onClick={() => setShowDisconnectDialog(true)}
              disabled={tenant.connection_status === 'disconnected'}
              title="Desconectar (mantém dados)"
            >
              <Unplug className="w-3 h-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border"
              onClick={() => setShowDeleteDialog(true)}
              title="Excluir permanentemente"
            >
              <Trash2 className="w-3 h-3" />
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
              className="bg-amber-600 text-white hover:bg-amber-700"
              disabled={disconnecting}
            >
              {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tenant Permanentemente</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja <strong>excluir permanentemente</strong> o tenant "{tenant.display_name || tenant.tenant_domain}"?
              </p>
              <p className="text-destructive font-medium">
                Esta ação não pode ser desfeita. Serão excluídos:
              </p>
              <ul className="list-disc ml-4 text-sm">
                <li>Credenciais de conexão (App ID, Client Secret)</li>
                <li>Tokens de acesso</li>
                <li>Status de permissões</li>
                <li>Configurações de submódulos</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Os logs de auditoria serão mantidos para histórico.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}