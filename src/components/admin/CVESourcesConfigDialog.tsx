import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useCVESources, CVESource } from '@/hooks/useCVECache';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, XCircle, Clock, Database } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODULE_LABELS: Record<string, string> = {
  firewall: 'Firewall',
  m365: 'Microsoft 365',
  external_domain: 'Domínio Externo',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  nist_nvd: 'NIST NVD',
  msrc: 'MSRC',
  nist_nvd_web: 'NIST NVD (Web)',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  success: { icon: CheckCircle2, label: 'Sincronizado', className: 'text-emerald-400' },
  error: { icon: XCircle, label: 'Erro', className: 'text-rose-400' },
  syncing: { icon: RefreshCw, label: 'Sincronizando...', className: 'text-blue-400 animate-spin' },
  pending: { icon: Clock, label: 'Pendente', className: 'text-muted-foreground' },
};

export function CVESourcesConfigDialog({ open, onOpenChange }: Props) {
  const { data: sources, isLoading } = useCVESources();
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleToggle = async (source: CVESource) => {
    const { error } = await supabase
      .from('cve_sources')
      .update({ is_active: !source.is_active })
      .eq('id', source.id);

    if (error) {
      toast.error('Erro ao atualizar fonte');
    } else {
      toast.success(`Fonte ${!source.is_active ? 'ativada' : 'desativada'}`);
      queryClient.invalidateQueries({ queryKey: ['cve-sources'] });
    }
  };

  const handleSync = async (source: CVESource) => {
    setSyncingId(source.id);
    try {
      const { error } = await supabase.functions.invoke('refresh-cve-cache', {
        body: { source_id: source.id },
      });

      if (error) throw error;
      toast.success(`Sincronização de "${source.source_label}" iniciada`);
      queryClient.invalidateQueries({ queryKey: ['cve-sources'] });
      queryClient.invalidateQueries({ queryKey: ['cve-cache'] });
    } catch {
      toast.error('Erro ao iniciar sincronização');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Configurar Fontes de CVE
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))
          ) : !sources || sources.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma fonte configurada.</p>
          ) : (
            sources.map((source) => {
              const statusConfig = STATUS_CONFIG[source.last_sync_status || 'pending'] || STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;
              const isSyncing = syncingId === source.id;

              return (
                <div key={source.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{source.source_label}</h3>
                        <Badge variant="outline" className="text-xs">
                          {MODULE_LABELS[source.module_code] || source.module_code}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {SOURCE_TYPE_LABELS[source.source_type] || source.source_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <StatusIcon className={cn('w-4 h-4', statusConfig.className)} />
                          <span className="text-muted-foreground">{statusConfig.label}</span>
                        </div>
                        {source.last_sync_at && (
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(source.last_sync_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                        {source.last_sync_count > 0 && (
                          <span className="text-muted-foreground">
                            {source.last_sync_count} CVEs
                          </span>
                        )}
                      </div>
                      {source.last_sync_error && (
                        <p className="text-xs text-rose-400 mt-1">{source.last_sync_error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={source.is_active}
                        onCheckedChange={() => handleToggle(source)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!source.is_active || isSyncing}
                        onClick={() => handleSync(source)}
                      >
                        <RefreshCw className={cn('w-4 h-4 mr-1', isSyncing && 'animate-spin')} />
                        Sincronizar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
