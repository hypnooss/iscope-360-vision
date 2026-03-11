import { useEffect, useMemo, useState } from 'react';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ExternalDomainCategorySection } from '@/components/external-domain/ExternalDomainCategorySection';
import { DNSMapSection } from '@/components/external-domain/DNSMapSection';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceCategory, ComplianceReport, SubdomainSummary } from '@/types/compliance';
import { toast } from 'sonner';
import {
  Loader2,
  FileDown,
  ArrowLeft,
  Globe,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { ExternalDomainPDF, CorrectionGuideData } from '@/components/pdf/ExternalDomainPDF';
import { useCategoryConfigs, getCategoryConfig } from '@/hooks/useCategoryConfig';
import { useQuery } from '@tanstack/react-query';

type LocationState = {
  report?: Record<string, unknown>;
  analysisCreatedAt?: string;
  domainMeta?: {
    domain_id: string;
    domain_name: string;
    domain_url: string;
    client_name?: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MiniStat: Ultra-compact stat display for Command Center Header
// ─────────────────────────────────────────────────────────────────────────────

interface MiniStatProps {
  value: number;
  label: string;
  variant?: "default" | "primary" | "success" | "destructive";
}

function MiniStat({ value, label, variant = "default" }: MiniStatProps) {
  const variantStyles = {
    default: {
      text: "text-foreground",
      border: "border-border/30",
      bg: "bg-background/50"
    },
  primary: {
    text: "text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/10"
  },
  success: {
    text: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/10"
  },
    destructive: {
      text: "text-rose-400",
      border: "border-rose-500/30",
      bg: "bg-rose-500/10"
    }
  };

  const style = variantStyles[variant];

  return (
    <div className={cn(
      "text-center px-4 py-2 rounded-lg border min-w-[100px]",
      style.bg,
      style.border
    )}>
      <span className={cn("text-xl font-bold tabular-nums block", style.text)}>
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailRow: Structured info row with label and value
// ─────────────────────────────────────────────────────────────────────────────

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
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <div className="flex-1 min-w-0">
          {indicator && (
            <span 
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2 mt-1.5",
                indicator === "success" ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
              )} 
            />
          )}
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "text-sm font-medium",
                    highlight ? "text-primary" : "text-foreground"
                  )}
                >
                  {v}
                </div>
              ))}
            </div>
          ) : (
            <span 
              className={cn(
                "text-sm font-medium",
                highlight ? "text-primary" : "text-foreground",
                indicator && "inline-flex items-center"
              )}
            >
              {value}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// deriveEmailAuthStatus: Extract SPF/DKIM/DMARC status from categories
// ─────────────────────────────────────────────────────────────────────────────

const deriveEmailAuthStatus = (categories: ComplianceCategory[]) => {
  const allChecks = categories.flatMap(c => c.checks);
  
  const spfCheck = allChecks.find(c => c.id === 'SPF-001');
  const spf = spfCheck?.status === 'pass';
  
  const dkimCheck = allChecks.find(c => c.id === 'DKIM-001');
  const dkim = dkimCheck?.status === 'pass';
  
  const dmarcCheck = allChecks.find(c => c.id === 'DMARC-001');
  const dmarc = dmarcCheck?.status === 'pass';
  
  return { spf, dkim, dmarc };
};

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
    'Domínio': 'Globe',
  };
  return icons[name] || 'CheckCircle';
};

const calculatePassRate = (checks: { status: string }[]): number => {
  if (!checks || checks.length === 0) return 0;
  const applicable = checks.filter(c => c.status !== 'not_found');
  if (applicable.length === 0) return -1;
  const passed = applicable.filter(c => c.status === 'pass').length;
  return Math.round((passed / applicable.length) * 100);
};

const deriveDnsSummaryFromCategories = (categories: ComplianceCategory[]): ComplianceReport['dnsSummary'] | undefined => {
  const allChecks = categories.flatMap((c) => c.checks || []);

  const findByStep = (stepId: string) => allChecks.find((ch: any) => (ch as any)?.rawData?.step_id === stepId);

  const nsCheck: any = findByStep('ns_records');
  const soaCheck: any = findByStep('soa_record');
  const dnssecCheck: any = findByStep('dnssec_status');

  const nsRecords = nsCheck?.rawData?.data?.records;
  const ns = Array.isArray(nsRecords)
    ? nsRecords
        .map((r: any) => {
          if (typeof r === 'string') return r;
          const host = r?.host ?? r?.name ?? r?.value;
          return typeof host === 'string' ? host : undefined;
        })
        .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
    : undefined;

  const soaMname = (soaCheck?.rawData?.data?.mname ?? soaCheck?.rawData?.data?.soa_mname) ?? null;
  const soaContact = (soaCheck?.rawData?.data?.contact_email ?? soaCheck?.rawData?.data?.soa_contact) ?? null;

  const dnssecData = dnssecCheck?.rawData?.data;
  const dnssecHasDnskey = typeof dnssecData?.has_dnskey === 'boolean'
    ? dnssecData.has_dnskey
    : (typeof dnssecData?.hasDnskey === 'boolean' ? dnssecData.hasDnskey : undefined);
  const dnssecHasDs = typeof dnssecData?.has_ds === 'boolean'
    ? dnssecData.has_ds
    : (typeof dnssecData?.hasDs === 'boolean' ? dnssecData.hasDs : undefined);
  const dnssecValidated = typeof dnssecData?.validated === 'boolean'
    ? dnssecData.validated
    : (typeof dnssecData?.is_validated === 'boolean' ? dnssecData.is_validated : undefined);
  const dnssecNotes = Array.isArray(dnssecData?.notes)
    ? dnssecData.notes.filter((n: any) => typeof n === 'string')
    : undefined;

  const hasAny = !!(
    (ns && ns.length) ||
    (typeof soaMname === 'string' && soaMname) ||
    (typeof soaContact === 'string' && soaContact) ||
    dnssecHasDnskey !== undefined ||
    dnssecHasDs !== undefined ||
    dnssecValidated !== undefined ||
    (dnssecNotes && dnssecNotes.length)
  );
  if (!hasAny) return undefined;

  return {
    ns,
    soaMname: typeof soaMname === 'string' ? soaMname : null,
    soaContact: typeof soaContact === 'string' ? soaContact : null,
    dnssecHasDnskey,
    dnssecHasDs,
    dnssecValidated,
    dnssecNotes,
  };
};

const deriveDnsEvidenceFromRawData = (rawData: any): any[] | undefined => {
  const stepId = rawData?.step_id;
  const data = rawData?.data;
  if (!stepId || !data) return undefined;

  if (stepId === 'ns_records') {
    const records = data?.records;
    const hosts = Array.isArray(records)
      ? records
          .map((r: any) => (typeof r === 'string' ? r : (r?.host ?? r?.name ?? r?.value)))
          .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
      : [];
    return hosts.length
      ? [{ label: 'Nameservers encontrados', value: hosts.join(', '), type: 'text' }]
      : [{ label: 'Nameservers', value: 'Nenhum NS retornado', type: 'text' }];
  }

  if (stepId === 'soa_record') {
    const mname = data?.mname ?? data?.soa_mname;
    const contact = data?.contact_email ?? data?.soa_contact;
    return [
      { label: 'SOA mname', value: String(mname ?? 'N/A'), type: 'text' },
      { label: 'SOA contact', value: String(contact ?? 'N/A'), type: 'text' },
    ];
  }

  if (stepId === 'dnssec_status') {
    const hasDnskey = data?.has_dnskey ?? data?.hasDnskey ?? data?.has_dns_key;
    const hasDs = data?.has_ds ?? data?.hasDs;
    const validated = data?.validated ?? data?.is_validated;
    const notes = Array.isArray(data?.notes) ? data.notes.filter((n: any) => typeof n === 'string') : [];

    const items = [
      { label: 'DNSKEY', value: String(hasDnskey ?? 'N/A'), type: 'text' },
      { label: 'DS', value: String(hasDs ?? 'N/A'), type: 'text' },
      { label: 'Validated', value: String(validated ?? 'N/A'), type: 'text' },
    ];
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
    const hasBadNsEvidence = Array.isArray(currentEvidence)
      && currentEvidence.some((e) => (e?.value === 'Nenhum NS retornado'));

    const derivedEvidence = (isDnsStep && (!Array.isArray(currentEvidence) || currentEvidence.length === 0 || hasBadNsEvidence))
      ? deriveDnsEvidenceFromRawData(rawData)
      : undefined;

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
      return {
        name,
        icon: getIconForCategory(name),
        checks: normalizedChecks,
        passRate: calculatePassRate(normalizedChecks as { status: string }[]),
      };
    });
  } else if (Array.isArray(categories)) {
    categories = (categories as { name: string; icon?: string; checks: Record<string, unknown>[]; passRate?: number }[]).map(cat => ({
      ...cat,
      icon: cat.icon || getIconForCategory(cat.name),
      checks: (cat.checks || []).map(normalizeCheck),
      passRate: cat.passRate ?? calculatePassRate((cat.checks || []).map(normalizeCheck) as { status: string }[]),
    }));
  } else {
    categories = [];
  }

  const allChecks = (raw.checks as { status: string }[])
    ?? (categories as ComplianceCategory[])?.flatMap(c => c.checks)
    ?? [];

  const dnsSummaryFromBackend: ComplianceReport['dnsSummary'] | undefined = (raw.dns_summary as any)
    ? {
        ns: (raw.dns_summary as any).ns ?? undefined,
        soaMname: (raw.dns_summary as any).soa_mname ?? (raw.dns_summary as any).soaMname ?? null,
        soaContact: (raw.dns_summary as any).soa_contact ?? (raw.dns_summary as any).soaContact ?? null,
        dnssecHasDnskey: (raw.dns_summary as any).dnssec_has_dnskey ?? (raw.dns_summary as any).dnssecHasDnskey ?? undefined,
        dnssecHasDs: (raw.dns_summary as any).dnssec_has_ds ?? (raw.dns_summary as any).dnssecHasDs ?? undefined,
        dnssecValidated: (raw.dns_summary as any).dnssec_validated ?? (raw.dns_summary as any).dnssecValidated ?? undefined,
        dnssecNotes: (raw.dns_summary as any).dnssec_notes ?? (raw.dns_summary as any).dnssecNotes ?? undefined,
      }
    : undefined;

  const dnsSummaryDerived = !dnsSummaryFromBackend
    ? deriveDnsSummaryFromCategories(categories as ComplianceCategory[])
    : undefined;

  // Parse subdomain_summary from backend
  const subdomainSummaryFromBackend: SubdomainSummary | undefined = (raw.subdomain_summary as any)
    ? {
        total_found: (raw.subdomain_summary as any).total_found ?? 0,
        subdomains: Array.isArray((raw.subdomain_summary as any).subdomains) 
          ? (raw.subdomain_summary as any).subdomains 
          : [],
        sources: Array.isArray((raw.subdomain_summary as any).sources) 
          ? (raw.subdomain_summary as any).sources 
          : [],
        mode: (raw.subdomain_summary as any).mode ?? 'passive',
      }
    : undefined;

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

export default function ExternalDomainAnalysisReportPage() {
  const { id: domainId, analysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as LocationState;

  const initialReport = useMemo(() => {
    if (!state.report) return null;
    return normalizeReportData(state.report, state.analysisCreatedAt);
  }, [state.report, state.analysisCreatedAt]);

  const [loading, setLoading] = useState(!initialReport);
  const [report, setReport] = useState<ComplianceReport | null>(initialReport);

  const [domain, setDomain] = useState<{
    id: string;
    name: string;
    domain: string;
    client_id: string;
    agent_id?: string | null;
  } | null>(state.domainMeta ? {
    id: state.domainMeta.domain_id,
    name: state.domainMeta.domain_name,
    domain: state.domainMeta.domain_url,
    client_id: '',
    agent_id: null,
  } : null);

  const [clientName, setClientName] = useState<string | null>(state.domainMeta?.client_name || null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(state.analysisCreatedAt || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deviceTypeId, setDeviceTypeId] = useState<string | undefined>(undefined);
  const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();
  
  // Fetch category configs for external_domain device type
  const { data: categoryConfigs } = useCategoryConfigs(deviceTypeId);

  // Fetch correction guides for PDF
  const { data: correctionGuides } = useQuery({
    queryKey: ['correction-guides-pdf', deviceTypeId],
    queryFn: async () => {
      if (!deviceTypeId) return [];
      const { data, error } = await supabase
        .from('rule_correction_guides')
        .select(`
          *,
          compliance_rules!inner(code, device_type_id)
        `)
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

  const dnsSummary = report?.dnsSummary;
  const nsText = Array.isArray(dnsSummary?.ns) && dnsSummary?.ns.length > 0
    ? dnsSummary.ns.join(', ')
    : 'N/A';

  // Sort categories by display_order from configs
  const sortedCategories = useMemo(() => {
    if (!report?.categories || !categoryConfigs) return report?.categories || [];
    return [...report.categories].sort((a, b) => {
      const configA = categoryConfigs.find(c => c.name === a.name);
      const configB = categoryConfigs.find(c => c.name === b.name);
      return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
    });
  }, [report?.categories, categoryConfigs]);

  // Count only critical severity failures for the banner
  const criticalOnlyCount = useMemo(() => {
    if (!report?.categories) return 0;
    return report.categories
      .flatMap(c => c.checks)
      .filter(check => check.status === 'fail' && check.severity === 'critical')
      .length;
  }, [report]);

  const dnssecStatus = (() => {
    const hasDnskey = Boolean(dnsSummary?.dnssecHasDnskey);
    const hasDs = Boolean(dnsSummary?.dnssecHasDs);
    if (hasDnskey && hasDs) return 'Ativo';
    return 'Inativo';
  })();

  const dnssecNotesTooltip = (dnsSummary?.dnssecNotes && dnsSummary.dnssecNotes.length > 0)
    ? dnsSummary.dnssecNotes.join(' | ')
    : undefined;

  const emailAuth = useMemo(() => {
    return report ? deriveEmailAuthStatus(report.categories) : { spf: false, dkim: false, dmarc: false };
  }, [report]);

  useEffect(() => {
    if (initialReport) return;
    if (!domainId) return;
    void fetchData(domainId, analysisId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, analysisId]);

  const fetchData = async (dId: string, aId?: string) => {
    setLoading(true);
    try {
      // Fetch device type for external_domain
      const { data: deviceType } = await supabase
        .from('device_types')
        .select('id')
        .eq('code', 'external_domain')
        .eq('is_active', true)
        .maybeSingle();
      
      if (deviceType) {
        setDeviceTypeId(deviceType.id);
      }

      const { data: domainData } = await supabase
        .from('external_domains')
        .select('id, name, domain, client_id, agent_id')
        .eq('id', dId)
        .maybeSingle();

      if (domainData) {
        setDomain(domainData);

        const { data: clientData } = await supabase
          .from('clients')
          .select('name')
          .eq('id', domainData.client_id)
          .maybeSingle();

        setClientName(clientData?.name || null);
      }

      // Prefer analysisId, fallback to latest report for the domain
      const historyQuery = supabase
        .from('external_domain_analysis_history')
        .select('report_data, created_at')
        .eq('domain_id', dId)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: historyData } = aId
        ? await supabase
            .from('external_domain_analysis_history')
            .select('report_data, created_at')
            .eq('id', aId)
            .maybeSingle()
        : await historyQuery.maybeSingle();

      if (historyData?.report_data) {
        setGeneratedAt(historyData.created_at);
        setReport(normalizeReportData(historyData.report_data as Record<string, unknown>, historyData.created_at));
      } else {
        setReport(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!domainId) return;

    if (!domain?.agent_id) {
      toast.error('Este domínio não possui um agente associado para reanálise.');
      return;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-external-domain-analysis', {
        body: { domain_id: domainId },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any)?.details || (data as any)?.error);

      toast.success('Análise agendada! Acompanhe o status em Execuções.');
    } catch (err: any) {
      toast.error(`Erro ao reanalisar: ${err?.message || 'erro desconhecido'}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report || !domainId) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb
            items={[
              { label: 'Domínio Externo' },
            { label: 'Compliance', href: '/scope-external-domain/reports' },
              { label: domain?.name || 'Relatório' },
            ]}
          />

          <Button
            variant="ghost"
            onClick={() => navigate('/scope-external-domain/reports')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="text-center py-12 text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum relatório encontrado para este domínio.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb
          items={[
            { label: 'Domínio Externo' },
            { label: 'Compliance', href: '/scope-external-domain/reports' },
            { label: domain?.name || 'Relatório' },
          ]}
        />

        {/* Match FortiGate report top spacing (breadcrumb outside, content padded inside) */}
        <div className="pt-6 lg:pt-8">
          <div>
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Análise de Compliance</h1>
              <p className="text-muted-foreground">
                Relatório gerado em {new Date(generatedAt || report.generatedAt).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex gap-3 ml-auto">
              <Button 
                variant="outline" 
                size="lg" 
                disabled={isExportingPDF}
                onClick={async () => {
                  try {
                    const emailAuth = deriveEmailAuthStatus(report.categories);
                    const filename = `iscope360-${sanitizePDFFilename(domain?.domain || 'domain')}-${getPDFDateString()}.pdf`;
                    
                    // Load logo as base64
                    let logoBase64: string | undefined;
                    try {
                      const logoModule = await import('@/assets/logo-iscope.png');
                      const logoUrl = logoModule.default;
                      const response = await fetch(logoUrl);
                      const blob = await response.blob();
                      logoBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                      });
                    } catch (logoErr) {
                      console.warn('Could not load logo for PDF:', logoErr);
                    }
                    
                    await downloadPDF(
                      <ExternalDomainPDF
                        report={{ ...report, categories: sortedCategories }}
                        domainInfo={{
                          name: domain?.name || 'Domínio',
                          domain: domain?.domain || '',
                          clientName: clientName || undefined,
                        }}
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
                }}
              >
                <FileDown className={cn("w-4 h-4", isExportingPDF && "animate-pulse")} />
                {isExportingPDF ? 'Gerando...' : 'Exportar PDF'}
              </Button>
              <Button variant="cyber" size="lg" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Reanalisar
              </Button>
            </div>
          </div>

          {/* COMMAND CENTER HEADER */}
          {(() => {
            return (
              <div className="max-w-full mb-8">
                <div 
                  className="relative overflow-hidden rounded-2xl border border-primary/20"
                  style={{
                    background: "linear-gradient(145deg, hsl(220 18% 11%), hsl(220 18% 8%))"
                  }}
                >
                  {/* Grid pattern overlay */}
                  <div 
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(hsl(175 80% 45% / 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, hsl(175 80% 45% / 0.03) 1px, transparent 1px)
                      `,
                      backgroundSize: "32px 32px"
                    }}
                  />

                  <div className="relative p-8">
                    {/* Identification Strip */}
                    <div className="text-center mb-8">
                      <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-foreground uppercase">
                        {domain?.domain}
                      </h2>
                      <div className="h-0.5 w-48 mx-auto mt-3 bg-gradient-to-r from-transparent via-primary to-transparent" />
                    </div>

                    {/* Two-Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                      
                      {/* Left Panel: Score + Stats */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative">
                          <div 
                            className="absolute inset-0 blur-3xl opacity-20"
                            style={{ background: "radial-gradient(circle, hsl(175 80% 45%), transparent 70%)" }}
                          />
                          <ScoreGauge score={report.overallScore} size={180} />
                        </div>

                        {/* Mini Stats Row */}
                        <div className="flex gap-3 mt-14">
                          <MiniStat value={report.totalChecks} label="Total" variant="primary" />
                          <MiniStat value={report.passed} label="Aprovadas" variant="success" />
                          <MiniStat value={report.failed} label="Falhas" variant="destructive" />
                        </div>
                      </div>

                      {/* Right Panel: Details */}
                      <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                        <DetailRow label="SOA Primary" value={dnsSummary?.soaMname || 'N/A'} />
                        <DetailRow label="Nameservers" value={dnsSummary?.ns || []} />
                        <DetailRow label="Contato SOA" value={dnsSummary?.soaContact || 'N/A'} />
                        <DetailRow 
                          label="DNSSEC" 
                          value={dnssecStatus === 'Ativo' ? "Ativo" : "Inativo"} 
                          indicator={dnssecStatus === 'Ativo' ? "success" : "error"}
                        />
                        <DetailRow 
                          label="SPF" 
                          value={emailAuth.spf ? "Válido" : "Ausente"} 
                          indicator={emailAuth.spf ? "success" : "error"}
                        />
                        <DetailRow 
                          label="DKIM" 
                          value={emailAuth.dkim ? "Válido" : "Ausente"} 
                          indicator={emailAuth.dkim ? "success" : "error"}
                        />
                        <DetailRow 
                          label="DMARC" 
                          value={emailAuth.dmarc ? "Válido" : "Ausente"} 
                          indicator={emailAuth.dmarc ? "success" : "error"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Critical banner - only shows for critical severity items */}
          {criticalOnlyCount > 0 && (
            <div className="glass-card rounded-xl p-4 mb-8 border-destructive/50 bg-destructive/5 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-destructive">
                    {criticalOnlyCount} {criticalOnlyCount === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
                  </h3>
                  <p className="text-sm text-muted-foreground">Revise as falhas abaixo e aplique as correções recomendadas.</p>
                </div>
              </div>
            </div>
          )}

          {/* DNS Infrastructure Map */}
          <DNSMapSection
            domain={domain?.domain || ''}
            dnsSummary={report.dnsSummary}
            subdomainSummary={report.subdomainSummary}
            categories={report.categories}
            emailAuth={emailAuth}
            className="mb-8"
          />

          {/* Categories */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Verificações por Categoria</h2>
            {Array.isArray(sortedCategories) && sortedCategories.length > 0 ? (
              sortedCategories.map((category, index) => (
                <ExternalDomainCategorySection
                  key={`${category.name}-${index}`}
                  category={category}
                  index={index}
                  categoryConfigs={categoryConfigs}
                />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma categoria de verificação disponível.</p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
