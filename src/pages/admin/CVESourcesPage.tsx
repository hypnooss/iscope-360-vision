import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useCVESources, CVESource } from '@/hooks/useCVECache';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Database,
  Shield, AlertTriangle, Activity, Layers,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MODULE_LABELS: Record<string, string> = {
  firewall: 'Firewall',
  m365: 'Microsoft 365',
  external_domain: 'Domínio Externo',
};

const MODULE_COLORS: Record<string, string> = {
  firewall: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  m365: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  external_domain: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  success: { icon: CheckCircle2, label: 'Sincronizado', className: 'text-emerald-400' },
  error: { icon: XCircle, label: 'Erro', className: 'text-rose-400' },
  syncing: { icon: RefreshCw, label: 'Sincronizando...', className: 'text-blue-400 animate-spin' },
  pending: { icon: Clock, label: 'Pendente', className: 'text-muted-foreground' },
};

function SourceCard({ source, onToggle, onSync, isSyncing }: {
  source: CVESource;
  onToggle: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const statusConfig = STATUS_CONFIG[source.last_sync_status || 'pending'] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{source.source_label}</h3>
            <Badge variant="outline" className={cn('text-xs', MODULE_COLORS[source.module_code] || '')}>
              {MODULE_LABELS[source.module_code] || source.module_code}
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
              <span className="text-muted-foreground font-medium">
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
            onCheckedChange={onToggle}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!source.is_active || isSyncing}
            onClick={onSync}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isSyncing && 'animate-spin')} />
            Sincronizar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CVESourcesPage() {
  const { data: sources, isLoading } = useCVESources();
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const stats = useMemo(() => {
    if (!sources) return { total: 0, active: 0, errors: 0, totalCves: 0 };
    return {
      total: sources.length,
      active: sources.filter(s => s.is_active).length,
      errors: sources.filter(s => s.last_sync_status === 'error').length,
      totalCves: sources.reduce((acc, s) => acc + (s.last_sync_count || 0), 0),
    };
  }, [sources]);

  const grouped = useMemo(() => {
    if (!sources) return {};
    const groups: Record<string, CVESource[]> = {};
    for (const s of sources) {
      const key = s.module_code;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [sources]);

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

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const { error } = await supabase.functions.invoke('refresh-cve-cache', {
        body: {},
      });
      if (error) throw error;
      toast.success('Sincronização de todas as fontes iniciada');
      queryClient.invalidateQueries({ queryKey: ['cve-sources'] });
      queryClient.invalidateQueries({ queryKey: ['cve-cache'] });
    } catch {
      toast.error('Erro ao iniciar sincronização');
    } finally {
      setSyncingAll(false);
    }
  };

  const groupOrder = ['firewall', 'm365', 'external_domain'];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        <PageBreadcrumb items={[
          { label: 'Administração' },
          { label: 'CVEs', href: '/cves' },
          { label: 'Fontes' },
        ]} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fontes de CVE</h1>
            <p className="text-muted-foreground">Gerencie as fontes de sincronização de vulnerabilidades por produto</p>
          </div>
          <Button onClick={handleSyncAll} disabled={syncingAll} variant="outline" size="sm">
            <RefreshCw className={cn('w-4 h-4 mr-2', syncingAll && 'animate-spin')} />
            Sincronizar Todas
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Fontes" value={stats.total} icon={Layers} variant="default" delay={0} compact />
          <StatCard title="Ativas" value={stats.active} icon={Activity} variant="default" delay={0.05} compact />
          <StatCard title="CVEs Sincronizados" value={stats.totalCves} icon={Shield} variant="default" delay={0.1} compact />
          <StatCard title="Com Erro" value={stats.errors} icon={AlertTriangle} variant={stats.errors > 0 ? 'destructive' : 'default'} delay={0.15} compact />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : !sources || sources.length === 0 ? (
          <Card className="p-12 text-center">
            <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma fonte configurada.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupOrder.filter(g => grouped[g]).map(moduleCode => (
              <div key={moduleCode} className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs', MODULE_COLORS[moduleCode] || '')}>
                    {MODULE_LABELS[moduleCode] || moduleCode}
                  </Badge>
                </h2>
                <div className="space-y-2">
                  {grouped[moduleCode].map(source => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onToggle={() => handleToggle(source)}
                      onSync={() => handleSync(source)}
                      isSyncing={syncingId === source.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
