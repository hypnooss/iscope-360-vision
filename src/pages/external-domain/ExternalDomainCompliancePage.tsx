import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAuth } from '@/hooks/useEffectiveAuth';
import { usePreview } from '@/contexts/PreviewContext';
import { useWorkspaceSelector } from '@/hooks/useWorkspaceSelector';
import { useDomainSelector } from '@/hooks/useDomainSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ExternalDomainCategorySection } from '@/components/external-domain/ExternalDomainCategorySection';
import { DNSMapSection } from '@/components/external-domain/DNSMapSection';
import { ComplianceCategory, ComplianceReport, SubdomainSummary } from '@/types/compliance';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, FileDown, Globe, RefreshCw, XCircle, Play, Clock, Building2, Settings, ChevronDown, FileText, ClipboardList, AlertTriangle,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { ExternalDomainPDF, CorrectionGuideData } from '@/components/pdf/ExternalDomainPDF';
import { useCategoryConfigs } from '@/hooks/useCategoryConfig';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScheduleDialog } from '@/components/schedule/ScheduleDialog';
import { Progress } from '@/components/ui/progress';

// ── Mini UI components (same as ExternalDomainAnalysisReportPage) ────────────

interface MiniStatProps {
  value: number;
  label: string;
  variant?: "default" | "primary" | "success" | "destructive";
}

function MiniStat({ value, label, variant = "default" }: MiniStatProps) {
  const variantStyles = {
    default: { text: "text-foreground", border: "border-border/30", bg: "bg-background/50" },
    primary: { text: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
    success: { text: "text-primary", border: "border-primary/30", bg: "bg-primary/10" },
    destructive: { text: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10" },
  };
  const style = variantStyles[variant];
  return (
    <div className={cn("text-center px-4 py-2 rounded-lg border min-w-[100px]", style.bg, style.border)}>
      <span className={cn("text-xl font-bold tabular-nums block", style.text)}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string | string[];
  indicator?: "success" | "error";
  highlight?: boolean;
}

function DetailRow({ label, value, indicator, highlight }: DetailRowProps) {
  const isMultiline = Array.isArray(value);
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">{label}</span>
        <div className="flex-1 min-w-0">
          {indicator && (
            <span className={cn("inline-block w-2 h-2 rounded-full mr-2 mt-1.5",
              indicator === "success" ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
            )} />
          )}
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div key={i} className={cn("text-sm font-medium", highlight ? "text-primary" : "text-foreground")}>{v}</div>
              ))}
            </div>
          ) : (
            <span className={cn("text-sm font-medium", highlight ? "text-primary" : "text-foreground", indicator && "inline-flex items-center")}>{value}</span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const deriveEmailAuthStatus = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  return {
    spf: allChecks.find(c => c.id === 'SPF-001')?.status === 'pass',
    dkim: allChecks.find(c => c.id === 'DKIM-001')?.status === 'pass',
    dmarc: allChecks.find(c => c.id === 'DMARC-001')?.status === 'pass',
  };
};

const getIconForCategory = (name: string): string => {
  const icons: Record<string, string> = {
    'Administração': 'Settings', 'Autenticação': 'Key', 'Logging': 'FileText',
    'Rede': 'Network', 'Segurança': 'Shield', 'Sistema': 'Server',
    'Domínio': 'Globe',
  };
  return icons[name] || 'CheckCircle';
};

const calculatePassRate = (checks: { status: string }[]): number => {
  if (!checks?.length) return 0;
  const applicable = checks.filter(c => c.status !== 'not_found');
  if (applicable.length === 0) return -1;
  return Math.round((applicable.filter(c => c.status === 'pass').length / applicable.length) * 100);
};

const deriveDnsSummaryFromCategories = (categories: ComplianceCategory[]): ComplianceReport['dnsSummary'] | undefined => {
  const allChecks = categories.flatMap(c => c.checks || []);
  const findByStep = (stepId: string) => allChecks.find((ch: any) => ch?.rawData?.step_id === stepId);

  const nsCheck: any = findByStep('ns_records');
  const soaCheck: any = findByStep('soa_record');
  const dnssecCheck: any = findByStep('dnssec_status');

  const nsRecords = nsCheck?.rawData?.data?.records;
  const ns = Array.isArray(nsRecords)
    ? nsRecords.map((r: any) => typeof r === 'string' ? r : (r?.host ?? r?.name ?? r?.value)).filter((h: any) => typeof h === 'string' && h.trim().length > 0)
    : undefined;

  const soaMname = soaCheck?.rawData?.data?.mname ?? soaCheck?.rawData?.data?.soa_mname ?? null;
  const soaContact = soaCheck?.rawData?.data?.contact_email ?? soaCheck?.rawData?.data?.soa_contact ?? null;

  const dnssecData = dnssecCheck?.rawData?.data;
  const dnssecHasDnskey = dnssecData?.has_dnskey ?? dnssecData?.hasDnskey ?? undefined;
  const dnssecHasDs = dnssecData?.has_ds ?? dnssecData?.hasDs ?? undefined;
  const dnssecValidated = dnssecData?.validated ?? dnssecData?.is_validated ?? undefined;
  const dnssecNotes = Array.isArray(dnssecData?.notes) ? dnssecData.notes.filter((n: any) => typeof n === 'string') : undefined;

  const hasAny = !!((ns && ns.length) || soaMname || soaContact || dnssecHasDnskey !== undefined || dnssecHasDs !== undefined || dnssecValidated !== undefined || (dnssecNotes && dnssecNotes.length));
  if (!hasAny) return undefined;

  return { ns, soaMname, soaContact, dnssecHasDnskey, dnssecHasDs, dnssecValidated, dnssecNotes };
};

const deriveDnsEvidenceFromRawData = (rawData: any): any[] | undefined => {
  const stepId = rawData?.step_id;
  const data = rawData?.data;
  if (!stepId || !data) return undefined;

  if (stepId === 'ns_records') {
    const records = data?.records;
    const hosts = Array.isArray(records) ? records.map((r: any) => typeof r === 'string' ? r : (r?.host ?? r?.name ?? r?.value)).filter((h: any) => typeof h === 'string' && h.trim().length > 0) : [];
    return hosts.length ? [{ label: 'Nameservers encontrados', value: hosts.join(', '), type: 'text' }] : [{ label: 'Nameservers', value: 'Nenhum NS retornado', type: 'text' }];
  }
  if (stepId === 'soa_record') {
    return [
      { label: 'SOA mname', value: String(data?.mname ?? data?.soa_mname ?? 'N/A'), type: 'text' },
      { label: 'SOA contact', value: String(data?.contact_email ?? data?.soa_contact ?? 'N/A'), type: 'text' },
    ];
  }
  if (stepId === 'dnssec_status') {
    const items = [
      { label: 'DNSKEY', value: String(data?.has_dnskey ?? data?.hasDnskey ?? 'N/A'), type: 'text' },
      { label: 'DS', value: String(data?.has_ds ?? data?.hasDs ?? 'N/A'), type: 'text' },
      { label: 'Validated', value: String(data?.validated ?? data?.is_validated ?? 'N/A'), type: 'text' },
    ];
    const notes = Array.isArray(data?.notes) ? data.notes.filter((n: any) => typeof n === 'string') : [];
    if (notes.length) items.push({ label: 'Notes', value: notes.slice(0, 10).join(' | '), type: 'text' });
    return items;
  }
  return undefined;
};

const normalizeReportData = (raw: Record<string, unknown>, createdAt?: string): ComplianceReport => {
  const normalizeCheck = (check: Record<string, unknown>) => {
    const rawData: any = (check as any).rawData;
    const stepId = rawData?.step_id;
    const isDnsStep = ['ns_records', 'soa_record', 'dnssec_status'].includes(stepId);
    const currentEvidence: any[] | undefined = (check as any).evidence;
    const hasBadNsEvidence = Array.isArray(currentEvidence) && currentEvidence.some(e => e?.value === 'Nenhum NS retornado');
    const derivedEvidence = (isDnsStep && (!Array.isArray(currentEvidence) || currentEvidence.length === 0 || hasBadNsEvidence))
      ? deriveDnsEvidenceFromRawData(rawData) : undefined;

    return {
      ...check,
      description: check.description || check.details || check.name || '',
      status: check.status === 'warn' ? 'warning' : check.status,
      evidence: derivedEvidence ?? (check as any).evidence,
    };
  };

  let categories = raw.categories;
  if (categories && !Array.isArray(categories)) {
    categories = Object.entries(categories as Record<string, Record<string, unknown>[]>).map(([name, checks]) => {
      const normalizedChecks = (checks || []).map(normalizeCheck);
      return { name, icon: getIconForCategory(name), checks: normalizedChecks, passRate: calculatePassRate(normalizedChecks as { status: string }[]) };
    });
  } else if (Array.isArray(categories)) {
    categories = (categories as any[]).map(cat => ({
      ...cat, icon: cat.icon || getIconForCategory(cat.name),
      checks: (cat.checks || []).map(normalizeCheck),
      passRate: cat.passRate ?? calculatePassRate((cat.checks || []).map(normalizeCheck) as { status: string }[]),
    }));
  } else {
    categories = [];
  }

  const allChecks = (raw.checks as { status: string }[]) ?? (categories as ComplianceCategory[])?.flatMap(c => c.checks) ?? [];

  const dnsSummaryFromBackend: ComplianceReport['dnsSummary'] | undefined = (raw.dns_summary as any) ? {
    ns: (raw.dns_summary as any).ns ?? undefined,
    soaMname: (raw.dns_summary as any).soa_mname ?? (raw.dns_summary as any).soaMname ?? null,
    soaContact: (raw.dns_summary as any).soa_contact ?? (raw.dns_summary as any).soaContact ?? null,
    dnssecHasDnskey: (raw.dns_summary as any).dnssec_has_dnskey ?? (raw.dns_summary as any).dnssecHasDnskey ?? undefined,
    dnssecHasDs: (raw.dns_summary as any).dnssec_has_ds ?? (raw.dns_summary as any).dnssecHasDs ?? undefined,
    dnssecValidated: (raw.dns_summary as any).dnssec_validated ?? (raw.dns_summary as any).dnssecValidated ?? undefined,
    dnssecNotes: (raw.dns_summary as any).dnssec_notes ?? (raw.dns_summary as any).dnssecNotes ?? undefined,
  } : undefined;

  const dnsSummaryDerived = !dnsSummaryFromBackend ? deriveDnsSummaryFromCategories(categories as ComplianceCategory[]) : undefined;

  const subdomainSummaryFromBackend: SubdomainSummary | undefined = (raw.subdomain_summary as any) ? {
    total_found: (raw.subdomain_summary as any).total_found ?? 0,
    subdomains: Array.isArray((raw.subdomain_summary as any).subdomains) ? (raw.subdomain_summary as any).subdomains : [],
    sources: Array.isArray((raw.subdomain_summary as any).sources) ? (raw.subdomain_summary as any).sources : [],
    mode: (raw.subdomain_summary as any).mode ?? 'passive',
  } : undefined;

  return {
    overallScore: (raw.overallScore as number) ?? (raw.score as number) ?? 0,
    totalChecks: allChecks.length,
    passed: allChecks.filter(c => c.status === 'pass').length,
    failed: allChecks.filter(c => c.status === 'fail').length,
    warnings: allChecks.filter(c => c.status === 'warn' || c.status === 'warning').length,
    categories: categories as ComplianceCategory[],
    generatedAt: new Date(createdAt || (raw.generatedAt as string) || Date.now()),
    firmwareVersion: (raw.firmwareVersion as string) ?? undefined,
    dnsSummary: dnsSummaryFromBackend ?? dnsSummaryDerived,
    subdomainSummary: subdomainSummaryFromBackend,
    systemInfo: undefined,
  };
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ExternalDomainCompliancePage() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveRole } = useEffectiveAuth();
  const { isPreviewMode } = usePreview();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStartedAt, setTaskStartedAt] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();

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

  // ── Domain list ──
  const { data: domains = [] } = useQuery({
    queryKey: ['compliance-domains', selectedWorkspaceId, isSuperRole],
    queryFn: async () => {
      let query = supabase.from('external_domains').select('id, name, domain, client_id, agent_id').order('name');
      if (isSuperRole && selectedWorkspaceId) {
        query = query.eq('client_id', selectedWorkspaceId);
      }
      const { data } = await query;
      return (data ?? []) as { id: string; name: string; domain: string; client_id: string; agent_id: string | null }[];
    },
    enabled: isSuperRole ? !!selectedWorkspaceId : true,
  });

  const { selectedDomainId, setSelectedDomainId } = useDomainSelector(domains);

  const selectedDomain = domains.find(d => d.id === selectedDomainId);

  // ── Snapshot list ──
  const { data: snapshots = [] } = useQuery({
    queryKey: ['domain-compliance-snapshots', selectedDomainId],
    queryFn: async () => {
      const { data } = await supabase
        .from('external_domain_analysis_history')
        .select('id, created_at, score')
        .eq('domain_id', selectedDomainId)
        .eq('source', 'agent')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!selectedDomainId,
  });

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');

  useEffect(() => {
    if (snapshots.length > 0) {
      setSelectedSnapshotId(snapshots[0].id);
    } else {
      setSelectedSnapshotId('');
    }
  }, [snapshots]);

  // ── Load snapshot data ──
  const { data: snapshotData, isLoading: loadingReport } = useQuery({
    queryKey: ['domain-compliance-report', selectedSnapshotId],
    queryFn: async () => {
      const { data } = await supabase
        .from('external_domain_analysis_history')
        .select('report_data, created_at, domain_id')
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

  // ── Device type for category configs ──
  const { data: deviceTypeId } = useQuery({
    queryKey: ['external-domain-device-type'],
    queryFn: async () => {
      const { data } = await supabase.from('device_types').select('id').eq('code', 'external_domain').eq('is_active', true).maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: categoryConfigs } = useCategoryConfigs(deviceTypeId || undefined);

  const { data: clientName } = useQuery({
    queryKey: ['domain-client-name', selectedDomain?.client_id],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('name').eq('id', selectedDomain!.client_id).single();
      return data?.name ?? null;
    },
    enabled: !!selectedDomain?.client_id,
  });

  // ── Correction guides for PDF ──
  const { data: correctionGuides } = useQuery({
    queryKey: ['correction-guides-pdf', deviceTypeId],
    queryFn: async () => {
      if (!deviceTypeId) return [];
      const { data, error } = await supabase
        .from('rule_correction_guides')
        .select('*, compliance_rules!inner(code, device_type_id)')
        .eq('compliance_rules.device_type_id', deviceTypeId);
      if (error) throw error;
      return (data || []).map(g => ({
        rule_code: g.compliance_rules.code,
        friendly_title: g.friendly_title,
        what_is: g.what_is,
        why_matters: g.why_matters,
        impacts: Array.isArray(g.impacts) ? g.impacts as string[] : [],
        how_to_fix: Array.isArray(g.how_to_fix) ? g.how_to_fix as string[] : [],
        provider_examples: Array.isArray(g.provider_examples) ? g.provider_examples as string[] : [],
        difficulty: g.difficulty as 'low' | 'medium' | 'high' | null,
        time_estimate: g.time_estimate,
      })) as CorrectionGuideData[];
    },
    enabled: !!deviceTypeId,
  });

  // ── Derived data ──
  const emailAuth = useMemo(() => report ? deriveEmailAuthStatus(report.categories) : { spf: false, dkim: false, dmarc: false }, [report]);

  const sortedCategories = useMemo(() => {
    if (!report?.categories || !categoryConfigs) return report?.categories || [];
    return [...report.categories].sort((a, b) => {
      const configA = categoryConfigs.find(c => c.name === a.name);
      const configB = categoryConfigs.find(c => c.name === b.name);
      return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
    });
  }, [report?.categories, categoryConfigs]);


  const dnsSummary = report?.dnsSummary;
  const dnssecStatus = (() => {
    if (Boolean(dnsSummary?.dnssecHasDnskey) && Boolean(dnsSummary?.dnssecHasDs)) return 'Ativo';
    return 'Inativo';
  })();

  // ── Task polling ──
  const { data: taskStatus } = useQuery({
    queryKey: ['domain-compliance-task', activeTaskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_tasks')
        .select('status, error_message, started_at')
        .eq('id', activeTaskId!)
        .single();
      return data;
    },
    enabled: !!activeTaskId,
    refetchInterval: 15000,
  });

  // Detect in-progress task on mount
  useQuery({
    queryKey: ['domain-active-task', selectedDomainId],
    queryFn: async () => {
      if (!selectedDomainId) return null;
      const { data } = await supabase
        .from('agent_tasks')
        .select('id, created_at, status')
        .eq('target_id', selectedDomainId)
        .eq('target_type', 'external_domain')
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && !activeTaskId) {
        setActiveTaskId(data.id);
        setTaskStartedAt(new Date(data.created_at));
        setIsRefreshing(true);
      }
      return data;
    },
    enabled: !!selectedDomainId && !activeTaskId,
  });

  useEffect(() => {
    if (!taskStatus || !activeTaskId) return;
    const s = taskStatus.status;
    if (s === 'completed' || s === 'failed' || s === 'timeout') {
      if (s === 'completed') {
        toast.success('Análise concluída com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['domain-compliance-snapshots', selectedDomainId] });
      } else if (s === 'failed') {
        toast.error(`Análise falhou: ${taskStatus.error_message || 'erro desconhecido'}`);
      } else {
        toast.error('Análise expirou (timeout).');
      }
      setActiveTaskId(null);
      setTaskStartedAt(null);
      setIsRefreshing(false);
    }
  }, [taskStatus?.status]);

  // 10-minute safety timeout
  useEffect(() => {
    if (!taskStartedAt || !activeTaskId) return;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - taskStartedAt.getTime()) / 1000);
      if (secs > 600) {
        setActiveTaskId(null);
        setTaskStartedAt(null);
        setIsRefreshing(false);
        toast.error('A análise não respondeu em 10 minutos. Verifique o status manualmente.');
        queryClient.invalidateQueries({ queryKey: ['domain-compliance-snapshots', selectedDomainId] });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [taskStartedAt, activeTaskId, queryClient, selectedDomainId]);

  // Reset task state when domain changes
  useEffect(() => {
    setActiveTaskId(null);
    setTaskStartedAt(null);
    setIsRefreshing(false);
  }, [selectedDomainId]);

  const isTaskRunning = !!activeTaskId && (!taskStatus || taskStatus.status === 'pending' || taskStatus.status === 'running');

  // ── Actions ──
  const handleRefresh = async () => {
    if (!selectedDomainId || !selectedDomain?.agent_id) {
      toast.error('Este domínio não possui um agente associado para reanálise.');
      return;
    }
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-external-domain-analysis', {
        body: { domain_id: selectedDomainId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any)?.details || (data as any)?.error);
      if ((data as any)?.task_id) {
        setActiveTaskId((data as any).task_id);
        setTaskStartedAt(new Date());
      }
      toast.success('Análise agendada! O agent irá processar em breve.');
    } catch (err: any) {
      toast.error(`Erro ao reanalisar: ${err?.message || 'erro desconhecido'}`);
      setIsRefreshing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!report || !selectedDomain) return;
    try {
      const filename = `iscope360-${sanitizePDFFilename(selectedDomain.domain)}-${getPDFDateString()}.pdf`;
      let logoBase64: string | undefined;
      try {
        const logoModule = await import('@/assets/logo-iscope.png');
        const response = await fetch(logoModule.default);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {}
      
      await downloadPDF(
        <ExternalDomainPDF
          report={{ ...report, categories: sortedCategories }}
          domainInfo={{ name: selectedDomain.name, domain: selectedDomain.domain, clientName: clientName || undefined }}
          dnsSummary={dnsSummary || undefined}
          emailAuth={emailAuth}
          subdomainSummary={report.subdomainSummary || undefined}
          logoBase64={logoBase64}
          categoryConfigs={categoryConfigs}
          correctionGuides={correctionGuides}
        />,
        filename
      );
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao exportar PDF');
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
        <PageBreadcrumb items={[{ label: 'Domínio Externo' }, { label: 'Compliance' }]} />

        {/* Header row: title (left) | selectors + action (right) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Domain Compliance</h1>
            <p className="text-muted-foreground">Análise de conformidade de domínio externo</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperRole && allWorkspaces && (
              <Select value={selectedWorkspaceId || ''} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedDomainId(''); }}>
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

            <Select value={selectedDomainId || ''} onValueChange={setSelectedDomainId}>
              <SelectTrigger className="w-[200px]">
                <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Selecionar domínio" />
              </SelectTrigger>
              <SelectContent>
                {domains.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.domain && d.domain !== d.name ? ` (${d.domain})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!selectedDomainId} className="gap-0 pr-0">
                  <span className="px-3">Executar Ações</span>
                  <span className="border-l border-primary-foreground/30 h-full flex items-center px-2">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Gerar Análise
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} disabled={!report || isExportingPDF}>
                  {isExportingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Exportar CVE será implementado em breve.')}>
                  <FileText className="w-4 h-4 mr-2" />Exportar CVE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info('Gerar GMUD será implementado em breve.')}>
                  <ClipboardList className="w-4 h-4 mr-2" />Gerar GMUD
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              title="Configurar agendamento"
              disabled={!selectedDomainId}
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

        {/* Task progress bar */}
        {isTaskRunning && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Análise em andamento...</p>
                  <p className="text-xs text-muted-foreground">
                    {taskStatus?.status === 'running' ? 'O agent está processando' : 'Aguardando o agent iniciar'}
                    {taskStartedAt && ` · ${Math.round((Date.now() - taskStartedAt.getTime()) / 1000)}s`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['domain-compliance-task', activeTaskId] })}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <Progress value={taskStatus?.status === 'running' ? 60 : 20} className="h-2" />
          </div>
        )}

        {/* Content */}
        {!selectedDomainId ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Selecione um domínio para visualizar o relatório de compliance.</p>
          </div>
        ) : loadingReport ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !report ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-10 text-center max-w-md mx-auto">
              <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
              <p className="text-sm text-muted-foreground mb-5">Execute a primeira análise para visualizar o relatório de compliance.</p>
              <Button onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Executar Análise
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            {/* Command Center Header */}
            <div className="mb-8">
              <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card">
                <div className="relative p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-foreground uppercase">{selectedDomain?.domain}</h2>
                    <div className="h-0.5 w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-primary to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <div className="flex flex-col items-center justify-center">
                      <div>
                        <ScoreGauge score={report.overallScore} size={180} />
                      </div>
                      <div className="flex gap-3 mt-14">
                        <MiniStat value={report.totalChecks} label="Total" variant="primary" />
                        <MiniStat value={report.passed} label="Aprovadas" variant="success" />
                        <MiniStat value={report.failed} label="Falhas" variant="destructive" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                      <DetailRow label="SOA Primary" value={dnsSummary?.soaMname || 'N/A'} />
                      <DetailRow label="Nameservers" value={dnsSummary?.ns || []} />
                      <DetailRow label="Contato SOA" value={dnsSummary?.soaContact || 'N/A'} />
                      <DetailRow label="DNSSEC" value={dnssecStatus === 'Ativo' ? "Ativo" : "Inativo"} indicator={dnssecStatus === 'Ativo' ? "success" : "error"} />
                      <DetailRow label="SPF" value={emailAuth.spf ? "Válido" : "Ausente"} indicator={emailAuth.spf ? "success" : "error"} />
                      <DetailRow label="DKIM" value={emailAuth.dkim ? "Válido" : "Ausente"} indicator={emailAuth.dkim ? "success" : "error"} />
                      <DetailRow label="DMARC" value={emailAuth.dmarc ? "Válido" : "Ausente"} indicator={emailAuth.dmarc ? "success" : "error"} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical banner */}
            {criticalOnlyCount > 0 && (
              <div className="glass-card rounded-xl p-4 mb-8 border-destructive/50 bg-destructive/5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20"><XCircle className="w-5 h-5 text-destructive" /></div>
                  <div>
                    <h3 className="font-semibold text-destructive">
                      {criticalOnlyCount} {criticalOnlyCount === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Revise as falhas abaixo e aplique as correções recomendadas.</p>
                  </div>
                </div>
              </div>
            )}

            {/* DNS Map */}
            <DNSMapSection
              domain={selectedDomain?.domain || ''}
              dnsSummary={report.dnsSummary}
              subdomainSummary={report.subdomainSummary}
              categories={report.categories}
              emailAuth={emailAuth}
              className="mb-8"
            />

            {/* Categories */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground mb-4">Verificações por Categoria</h2>
              {sortedCategories.length > 0 ? (
                sortedCategories.map((category, index) => (
                  <ExternalDomainCategorySection key={`${category.name}-${index}`} category={category} index={index} categoryConfigs={categoryConfigs} />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground"><p>Nenhuma categoria de verificação disponível.</p></div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Dialog */}
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          entityId={selectedDomainId || ''}
          table="external_domain_schedules"
          entityColumn="domain_id"
          title="Agendamento do Compliance"
          description="Configure a frequência de execução automática da análise de compliance para este domínio."
          recommendation="A análise de compliance verifica a conformidade da configuração. Recomendamos agendar a execução 1 vez ao dia."
          allowHourly={false}
        />
      </div>
    </AppLayout>
  );
}
