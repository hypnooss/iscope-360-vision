import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ScoreGauge';
import { StatCard } from '@/components/StatCard';
import { CategorySection } from '@/components/CategorySection';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceCategory, ComplianceReport } from '@/types/compliance';
import { toast } from 'sonner';
import { TruncatedText } from '@/components/TruncatedText';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Loader2,
  ArrowLeft,
  ListChecks,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  Globe,
  RefreshCw,
  Building2,
  CalendarClock,
  XCircle,
} from 'lucide-react';

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

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Optional tooltip content (keeps value displayed short) */
  tooltip?: string;
};

function InfoRow({ icon, label, value, tooltip }: InfoRowProps) {
  return (
    <div className="min-w-0 flex items-center gap-2">
      <span className="flex-shrink-0 text-primary">{icon}</span>

      {tooltip ? (
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 flex-1 font-medium text-foreground truncate" tabIndex={0}>
                {value || 'N/A'}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm break-words">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <TruncatedText
          text={value}
          className="font-medium text-foreground"
          maxWidthClassName="min-w-0 flex-1"
        />
      )}

      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

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
  const passed = checks.filter(c => c.status === 'pass').length;
  return Math.round((passed / checks.length) * 100);
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

  const dnsSummary = report?.dnsSummary;
  const nsText = Array.isArray(dnsSummary?.ns) && dnsSummary?.ns.length > 0
    ? dnsSummary.ns.join(', ')
    : 'N/A';

  const dnssecStatus = (() => {
    const hasDnskey = Boolean(dnsSummary?.dnssecHasDnskey);
    const hasDs = Boolean(dnsSummary?.dnssecHasDs);
    if (hasDnskey && hasDs) return 'Ativo';
    return 'Inativo';
  })();

  const dnssecNotesTooltip = (dnsSummary?.dnssecNotes && dnsSummary.dnssecNotes.length > 0)
    ? dnsSummary.dnssecNotes.join(' | ')
    : undefined;

  useEffect(() => {
    if (initialReport) return;
    if (!domainId) return;
    void fetchData(domainId, analysisId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, analysisId]);

  const fetchData = async (dId: string, aId?: string) => {
    setLoading(true);
    try {
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
              { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
              { label: 'Relatórios', href: '/scope-external-domain/reports' },
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
            { label: 'Domínio Externo', href: '/scope-external-domain/domains' },
            { label: 'Relatórios', href: '/scope-external-domain/reports' },
            { label: domain?.name || 'Relatório' },
          ]}
        />

        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Análise de Compliance</h1>
              <p className="text-muted-foreground">
                Relatório gerado em {new Date(generatedAt || report.generatedAt).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex gap-3 ml-auto">
              <Button variant="outline" size="lg" onClick={() => navigate('/scope-external-domain/reports')}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button variant="cyber" size="lg" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Reanalisar
              </Button>
            </div>
          </div>

          {/* Score + Info + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1 glass-card rounded-xl p-6 flex items-center justify-center">
              <ScoreGauge score={report.overallScore} />
            </div>

            <div className="lg:col-span-2 glass-card rounded-xl p-5 border border-primary/20 flex flex-col justify-center">
              {/* Parte superior: Info */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-4 items-start">
                <div className="hidden sm:flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg border border-primary/30">
                  <Globe className="w-10 h-10 text-primary mb-1" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Domínio</span>
                </div>

                <div className="min-w-0 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  <InfoRow
                    icon={<Globe className="w-4 h-4" />}
                    label="Domínio"
                    value={domain?.domain || 'N/A'}
                  />

                  <InfoRow
                    icon={<ShieldX className="w-4 h-4" />}
                    label="Nameservers (NS)"
                    value={nsText}
                  />

                  <InfoRow
                    icon={<ShieldX className="w-4 h-4" />}
                    label="SOA"
                    value={dnsSummary?.soaMname || 'N/A'}
                  />

                  <InfoRow
                    icon={<CalendarClock className="w-4 h-4" />}
                    label="SOA Contact"
                    value={dnsSummary?.soaContact || 'N/A'}
                  />

                  <InfoRow
                    icon={<ShieldX className="w-4 h-4" />}
                    label="DNSSEC Status"
                    value={dnssecStatus}
                    tooltip={dnssecNotesTooltip ? `Notes: ${dnssecNotesTooltip}` : undefined}
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="border-t border-border/50 my-4" />

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard title="Total" value={report.totalChecks} icon={ListChecks} variant="default" compact />
                <StatCard title="Aprovadas" value={report.passed} icon={CheckCircle2} variant="success" compact />
                <StatCard title="Falhas" value={report.failed} icon={ShieldX} variant="destructive" compact />
                <StatCard title="Alertas" value={report.warnings} icon={AlertTriangle} variant="warning" compact />
              </div>
            </div>
          </div>

          {/* Critical banner */}
          {report.failed > 0 && (
            <div className="glass-card rounded-xl p-4 mb-8 border-destructive/50 bg-destructive/5 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-destructive">
                    {report.failed} {report.failed === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
                  </h3>
                  <p className="text-sm text-muted-foreground">Revise as falhas abaixo e aplique as correções recomendadas.</p>
                </div>
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Verificações por Categoria</h2>
            {Array.isArray(report.categories) && report.categories.length > 0 ? (
              report.categories.map((category, index) => (
                <CategorySection key={`${category.name}-${index}`} category={category} index={index} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma categoria de verificação disponível.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
