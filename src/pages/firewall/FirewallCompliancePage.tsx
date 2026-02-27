import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { usePreview } from '@/contexts/PreviewContext';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useFirewallSelector } from '@/hooks/useFirewallSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Dashboard } from '@/components/Dashboard';
import { ComplianceReport, ComplianceCategory } from '@/types/compliance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play, Clock, Building2, FileText, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategoryConfigs } from '@/hooks/useCategoryConfig';
import { useQuery } from '@tanstack/react-query';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getIconForCategory = (name: string): string => {
  const icons: Record<string, string> = {
    'Administração': 'Settings',
    'Autenticação': 'Key',
    'Logging': 'FileText',
    'Rede': 'Network',
    'Segurança': 'Shield',
    'Sistema': 'Server',
    'Alta Disponibilidade': 'Server',
    'Atualizações e Firmware': 'RefreshCw',
    'Backup e Recovery': 'HardDrive',
    'Configuração VPN': 'Lock',
    'Configuração de Rede': 'Network',
    'Licenciamento': 'Key',
  };
  return icons[name] || 'CheckCircle';
};

const calculatePassRate = (checks: { status: string }[]): number => {
  if (!checks || checks.length === 0) return 0;
  const passed = checks.filter(c => c.status === 'pass').length;
  return Math.round((passed / checks.length) * 100);
};

const normalizeReportData = (rawData: Record<string, unknown>, createdAt?: string): ComplianceReport => {
  const normalizeCheck = (check: Record<string, unknown>) => ({
    ...check,
    description: check.description || check.details || check.name || '',
    status: check.status === 'warn' ? 'warning' : check.status,
  });

  let categories = rawData.categories;
  if (categories && !Array.isArray(categories)) {
    categories = Object.entries(categories as Record<string, Record<string, unknown>[]>).map(([name, checks]) => {
      const normalizedChecks = (checks || []).map(normalizeCheck);
      return {
        name,
        icon: getIconForCategory(name),
        checks: normalizedChecks,
        passRate: calculatePassRate(normalizedChecks as { status: string }[]),
      };
    });
  } else if (Array.isArray(categories)) {
    categories = (categories as any[]).map(cat => ({
      ...cat,
      icon: cat.icon || getIconForCategory(cat.name),
      checks: (cat.checks || []).map(normalizeCheck),
      passRate: cat.passRate ?? calculatePassRate((cat.checks || []).map(normalizeCheck) as { status: string }[]),
    }));
  } else {
    categories = [];
  }

  const allChecks = (rawData.checks as { status: string }[])
    ?? (categories as ComplianceCategory[])?.flatMap(c => c.checks)
    ?? [];

  const firmwareVersion = (rawData.firmwareVersion as string)
    ?? ((rawData.system_info as Record<string, unknown>)?.version as string)
    ?? undefined;

  const rawSystemInfo = rawData.system_info as Record<string, unknown> | undefined;
  const systemInfo = rawSystemInfo ? {
    hostname: rawSystemInfo.hostname as string | undefined,
    model: rawSystemInfo.model as string | undefined,
    serial: rawSystemInfo.serial as string | undefined,
    uptime: rawSystemInfo.uptime as string | undefined,
    vendor: rawSystemInfo.vendor as string | undefined,
  } : undefined;

  return {
    overallScore: (rawData.overallScore as number) ?? (rawData.score as number) ?? 0,
    totalChecks: allChecks.length,
    passed: allChecks.filter(c => c.status === 'pass').length,
    failed: allChecks.filter(c => c.status === 'fail').length,
    warnings: allChecks.filter(c => c.status === 'warn' || c.status === 'warning').length,
    categories: categories as ComplianceCategory[],
    generatedAt: createdAt ? new Date(createdAt) : rawData.generatedAt ? new Date(rawData.generatedAt as string) : undefined,
    firmwareVersion,
    systemInfo,
  };
};

// ── Component ────────────────────────────────────────────────────────────────

export default function FirewallCompliancePage() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole } = useEffectiveAuth();
  const { isPreviewMode } = usePreview();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const isSuperRole = effectiveRole === 'super_admin' || effectiveRole === 'super_suporte';

  // ── Workspace selector ──
  const { data: allWorkspaces } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuperRole && !isPreviewMode,
    staleTime: 1000 * 60 * 5,
  });

  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceSelector(allWorkspaces, isSuperRole);

  // ── Firewall list ──
  const { data: firewalls = [] } = useQuery({
    queryKey: ['compliance-firewalls', selectedWorkspaceId, isSuperRole],
    queryFn: async () => {
      let query = supabase.from('firewalls').select('id, name, client_id').order('name');
      if (isSuperRole && selectedWorkspaceId) {
        query = query.eq('client_id', selectedWorkspaceId);
      }
      const { data } = await query;
      return (data ?? []) as { id: string; name: string; client_id: string }[];
    },
    enabled: isSuperRole ? !!selectedWorkspaceId : true,
  });

  const { selectedFirewallId, setSelectedFirewallId } = useFirewallSelector(firewalls);

  // ── Snapshot list (history) for the selected firewall ──
  const { data: snapshots = [] } = useQuery({
    queryKey: ['fw-compliance-snapshots', selectedFirewallId],
    queryFn: async () => {
      const { data } = await supabase
        .from('analysis_history')
        .select('id, created_at, score')
        .eq('firewall_id', selectedFirewallId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!selectedFirewallId,
  });

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');

  // Auto-select latest snapshot
  useEffect(() => {
    if (snapshots.length > 0) {
      setSelectedSnapshotId(snapshots[0].id);
    } else {
      setSelectedSnapshotId('');
    }
  }, [snapshots]);

  // ── Load selected snapshot data ──
  const { data: snapshotData, isLoading: loadingReport } = useQuery({
    queryKey: ['fw-compliance-report', selectedSnapshotId],
    queryFn: async () => {
      const { data } = await supabase
        .from('analysis_history')
        .select('report_data, created_at, firewall_id')
        .eq('id', selectedSnapshotId)
        .single();
      return data;
    },
    enabled: !!selectedSnapshotId,
  });

  const report = useMemo(() => {
    if (!snapshotData?.report_data) return null;
    return normalizeReportData(snapshotData.report_data as Record<string, unknown>, snapshotData.created_at);
  }, [snapshotData]);

  // ── Firewall metadata ──
  const { data: firewallMeta } = useQuery({
    queryKey: ['fw-compliance-meta', selectedFirewallId],
    queryFn: async () => {
      const { data } = await supabase
        .from('firewalls')
        .select('name, fortigate_url, device_type_id, client_id')
        .eq('id', selectedFirewallId)
        .single();
      return data;
    },
    enabled: !!selectedFirewallId,
  });

  const { data: deviceVendor } = useQuery({
    queryKey: ['fw-device-vendor', firewallMeta?.device_type_id],
    queryFn: async () => {
      const { data } = await supabase.from('device_types').select('vendor').eq('id', firewallMeta!.device_type_id!).single();
      return data?.vendor ?? null;
    },
    enabled: !!firewallMeta?.device_type_id,
  });

  const { data: clientName } = useQuery({
    queryKey: ['fw-client-name', firewallMeta?.client_id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('name').eq('id', firewallMeta!.client_id!).single();
      return data?.name ?? null;
    },
    enabled: !!firewallMeta?.client_id,
  });

  const { data: categoryConfigs } = useCategoryConfigs(firewallMeta?.device_type_id || undefined);

  // ── Trigger analysis ──
  const handleRefresh = async () => {
    if (!selectedFirewallId) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-firewall-analysis', {
        body: { firewall_id: selectedFirewallId },
      });
      if (error) throw error;
      if (!data.success) {
        if (data.task_id) {
          toast.info(data.message || 'Já existe uma análise em andamento.');
        } else {
          throw new Error(data.error || 'Erro ao criar tarefa');
        }
        return;
      }
      toast.success('Análise agendada! O agent irá processar em breve.');
    } catch (error: any) {
      toast.error('Erro ao agendar análise: ' + error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Firewall' }, { label: 'Compliance' }]} />

        {/* Header row: title (left) | selectors + action (right) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Firewall Compliance</h1>
            <p className="text-muted-foreground">Análise de conformidade de firewall</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && allWorkspaces && (
              <Select value={selectedWorkspaceId || ''} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedFirewallId(''); }}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {allWorkspaces.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedFirewallId || ''} onValueChange={setSelectedFirewallId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar firewall" />
              </SelectTrigger>
              <SelectContent>
                {firewalls.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleRefresh} disabled={isRefreshing || !selectedFirewallId}>
              {isRefreshing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando...</>
                : <><Play className="w-4 h-4 mr-2" />Executar Análise</>}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Configurar agendamento"
              disabled={!selectedFirewallId}
              onClick={() => setScheduleDialogOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Last collection info */}
        {latestSnapshot && (
          <div className="flex items-center gap-3 flex-wrap">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Última coleta:</span>
            <Badge variant="outline" className="text-xs">
              {new Date(latestSnapshot.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Badge>
            {latestSnapshot.score != null && (
              <Badge variant="secondary" className="text-xs">
                Score: {latestSnapshot.score}
              </Badge>
            )}
          </div>
        )}

        {/* Content */}
        {!selectedFirewallId ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Selecione um firewall para visualizar o relatório de compliance.</p>
          </div>
        ) : loadingReport ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !report ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Nenhuma análise encontrada para este firewall.</p>
            <p className="text-sm mt-2">Execute uma nova análise para ver os resultados.</p>
            <Button className="mt-4" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Analisar agora
            </Button>
          </div>
        ) : (
          <Dashboard
            report={report}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            firewallName={firewallMeta?.name}
            firewallUrl={firewallMeta?.fortigate_url}
            deviceVendor={deviceVendor}
            clientName={clientName}
            categoryConfigs={categoryConfigs}
            skipGaugeAnimation={true}
            hideHeader={true}
          />
        )}

        {/* Schedule Dialog */}
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          entityId={selectedFirewallId || ''}
          table="analysis_schedules"
          entityColumn="firewall_id"
          title="Agendamento do Compliance"
          description="Configure a frequência de execução automática da análise de compliance para este firewall."
          recommendation="A análise de compliance verifica a conformidade da configuração. Recomendamos agendar a execução 1 vez ao dia."
        />
      </div>
    </AppLayout>
  );
}
