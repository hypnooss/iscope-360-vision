import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
  ChevronUp,
  Play,
  Lock,
  Calendar,
  TrendingUp,
  Settings2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TenantConnection, TenantPermission } from '@/hooks/useTenantConnection';
import { usePreviewGuard } from '@/hooks/usePreviewGuard';
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
import { toast } from 'sonner';
import { ExchangeRbacSetupDialog } from './ExchangeRbacSetupDialog';
// Permission categories organized by Microsoft product
// Note: User.Read is a delegated permission, not applicable to Client Credentials flow
const PERMISSION_CATEGORIES = {
  'Entra ID': [
    'User.Read.All',
    'Directory.Read.All',
    'Group.Read.All',
    'Application.Read.All',
    'AuditLog.Read.All',
    'Organization.Read.All',
    'Policy.Read.All',
  ],
  'Exchange Online': [
    'MailboxSettings.Read',
    'Mail.Read',
    'RoleManagement.ReadWrite.Directory',
  ],
  'SharePoint': [
    'Sites.Read.All',
  ],
  'Certificados': [
    'Application.ReadWrite.All',
  ],
  'Outros': [
    'Reports.Read.All',
  ],
};

const DIRECTORY_ROLES = {
  'Exchange Online': [
    'Exchange Administrator',
  ],
  'SharePoint': [
    'SharePoint Administrator',
  ],
};

const ALL_PERMISSIONS = [
  ...Object.values(PERMISSION_CATEGORIES).flat(),
  ...Object.values(DIRECTORY_ROLES).flat(),
];

interface LastAnalysis {
  score: number | null;
  status: string;
  created_at: string;
}

interface TenantStatusCardProps {
  tenant: TenantConnection;
  onTest: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  onUpdatePermissions?: (tenantId: string) => void;
  onEdit?: (tenantId: string) => void;
  lastAnalysis?: LastAnalysis | null;
  isAnalyzing?: boolean;
  onAnalyzeComplete?: () => void;
}

export function TenantStatusCard({ 
  tenant, 
  onTest, 
  onDisconnect,
  onDelete,
  onUpdatePermissions,
  onEdit,
  lastAnalysis,
  isAnalyzing: externalIsAnalyzing,
  onAnalyzeComplete
}: TenantStatusCardProps) {
  const navigate = useNavigate();
  const { isBlocked, showBlockedMessage } = usePreviewGuard();
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExchangeRbacDialog, setShowExchangeRbacDialog] = useState(false);
  const [permissions, setPermissions] = useState<TenantPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  // Use external analyzing state if provided
  const isCurrentlyAnalyzing = externalIsAnalyzing || analyzing;

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

  const handleAnalyze = async () => {
    if (isBlocked) {
      showBlockedMessage();
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-m365-posture-analysis', {
        body: { tenant_record_id: tenant.id },
      });

      if (error) {
        throw error;
      }

      toast.success('Análise iniciada', {
        description: 'A análise de postura foi iniciada. Acompanhe o progresso em Execuções.',
      });

      // Navigate to executions page
      navigate('/scope-m365/executions');
      onAnalyzeComplete?.();
    } catch (error: any) {
      console.error('Error triggering analysis:', error);
      toast.error('Erro ao iniciar análise', {
        description: error.message || 'Não foi possível iniciar a análise de postura.',
      });
    } finally {
      setAnalyzing(false);
    }
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
          <Badge className="bg-muted text-muted-foreground border-border">
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

  // Count granted permissions from all expected permissions
  const grantedCount = ALL_PERMISSIONS.filter(permName => 
    permissions.find(p => p.permission_name === permName && p.status === 'granted')
  ).length;
  const totalCount = ALL_PERMISSIONS.length;

  const canAnalyze = tenant.connection_status === 'connected' || tenant.connection_status === 'partial';

  return (
    <>
      <Card className="glass-card hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Building className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {tenant.display_name || tenant.tenant_domain || 'Tenant sem nome'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tenant.tenant_domain || `ID: ${tenant.tenant_id.slice(0, 8)}...`}
                </p>
              </div>
            </div>
            {getStatusBadge(tenant.connection_status)}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {/* Workspace */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Workspace</p>
              <p className="text-sm font-medium">{tenant.client.name}</p>
            </div>

            {/* Last Analysis */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Última Análise</p>
              {lastAnalysis ? (
                <p className="text-sm font-medium">
                  {format(new Date(lastAnalysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Nunca analisado</p>
              )}
            </div>

            {/* Score */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
              {lastAnalysis?.score !== null && lastAnalysis?.score !== undefined ? (
                <div className="flex items-center gap-2">
                  <TrendingUp className={cn(
                    "w-4 h-4",
                    lastAnalysis.score >= 80 ? "text-green-500" :
                    lastAnalysis.score >= 60 ? "text-yellow-500" : "text-red-500"
                  )} />
                  <span className={cn(
                    "text-sm font-bold",
                    lastAnalysis.score >= 80 ? "text-green-500" :
                    lastAnalysis.score >= 60 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {lastAnalysis.score}%
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>

            {/* Schedule */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Agendamento</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Não configurado</span>
              </div>
            </div>
          </div>

          {/* Permissions Section (Collapsible) */}
          <div className="pt-4 border-t border-border/50 mb-4">
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
              <div className="mt-4 space-y-6">
                {/* Graph Permissions */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Permissões do Microsoft Graph</p>
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{category}</p>
                        <ul className="text-sm space-y-1">
                          {perms.map(permName => {
                            const perm = permissions.find(p => p.permission_name === permName);
                            return (
                              <li key={permName} className="flex items-center gap-2">
                                <span className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  perm?.status === 'granted' ? 'bg-green-500' : 
                                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                                )} />
                                <span className="text-xs truncate">{permName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Directory Roles Section */}
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
                  <div className="grid gap-4 grid-cols-2">
                    {Object.entries(DIRECTORY_ROLES).map(([category, roles]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{category}</p>
                        <ul className="text-sm space-y-1">
                          {roles.map(roleName => {
                            const perm = permissions.find(p => p.permission_name === roleName);
                            return (
                              <li key={roleName} className="flex items-center gap-2">
                                <span className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  perm?.status === 'granted' ? 'bg-green-500' : 
                                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                                )} />
                                <span className="text-xs truncate">{roleName}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Row */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/50">
            {/* Left side actions */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTest}
                disabled={testing || tenant.connection_status === 'disconnected'}
              >
                {testing ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Testar
              </Button>
              
              {onEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(tenant.id)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              )}
              
              {onUpdatePermissions && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onUpdatePermissions(tenant.id)}
                  disabled={tenant.connection_status === 'disconnected'}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Permissões Graph API
                </Button>
              )}
              
              {/* Exchange/SharePoint RBAC Setup Button */}
              {(tenant.connection_status === 'connected' || tenant.connection_status === 'partial') && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExchangeRbacDialog(true)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 border-border"
                >
                  <Settings2 className="w-3 h-3 mr-1" />
                  Permissões RBAC
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-warning hover:text-warning hover:bg-warning/10 border-border"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={tenant.connection_status === 'disconnected'}
              >
                <Unplug className="w-3 h-3 mr-1" />
                Desconectar
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Excluir
              </Button>
            </div>

            {/* Right side - Analyze button */}
            <Button
              onClick={isBlocked ? showBlockedMessage : handleAnalyze}
              disabled={!canAnalyze || isCurrentlyAnalyzing}
              className="gap-2"
            >
              {isBlocked ? (
                <Lock className="w-4 h-4" />
              ) : isCurrentlyAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isCurrentlyAnalyzing ? 'Analisando...' : 'Analisar'}
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

      {/* Exchange RBAC Setup Dialog */}
      <ExchangeRbacSetupDialog
        open={showExchangeRbacDialog}
        onOpenChange={setShowExchangeRbacDialog}
        tenantRecordId={tenant.id}
        tenantDomain={tenant.tenant_domain || 'contoso.onmicrosoft.com'}
        onSuccess={() => {
          fetchPermissions();
        }}
      />
    </>
  );
}
