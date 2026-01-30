import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ScoreGauge';
import { StatCard } from '@/components/StatCard';
import { CategorySection } from '@/components/CategorySection';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceCategory, ComplianceReport } from '@/types/compliance';
import { Loader2, ArrowLeft, ListChecks, ShieldX, AlertTriangle, CheckCircle2, Globe } from 'lucide-react';

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

const normalizeReportData = (raw: Record<string, unknown>, createdAt?: string): ComplianceReport => {
  const normalizeCheck = (check: Record<string, unknown>) => ({
    ...check,
    description: check.description || check.details || check.name || '',
    status: check.status === 'warn' ? 'warning' : check.status,
  });

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

  return {
    overallScore: (raw.overallScore as number) ?? (raw.score as number) ?? 0,
    totalChecks: allChecks.length,
    passed: allChecks.filter(c => c.status === 'pass').length,
    failed: allChecks.filter(c => c.status === 'fail').length,
    warnings: allChecks.filter(c => c.status === 'warn' || c.status === 'warning').length,
    categories: categories as ComplianceCategory[],
    generatedAt: new Date(createdAt || (raw.generatedAt as string) || Date.now()),
    firmwareVersion: (raw.firmwareVersion as string) ?? undefined,
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
  } | null>(state.domainMeta ? {
    id: state.domainMeta.domain_id,
    name: state.domainMeta.domain_name,
    domain: state.domainMeta.domain_url,
    client_id: '',
  } : null);

  const [clientName, setClientName] = useState<string | null>(state.domainMeta?.client_name || null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(state.analysisCreatedAt || null);

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
        .select('id, name, domain, client_id')
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

        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório de Compliance</h1>
            <p className="text-muted-foreground">Resultado da análise do domínio externo</p>
          </div>

          <Button variant="outline" onClick={() => navigate('/scope-external-domain/reports')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{domain?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Domínio</p>
                <p className="font-medium text-foreground">{domain?.domain}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium text-foreground">{clientName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium text-foreground">
                  {new Date(generatedAt || report.generatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card lg:col-span-1">
            <CardContent className="pt-6 flex items-center justify-center">
              <ScoreGauge score={report.overallScore} />
            </CardContent>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total" value={report.totalChecks} icon={ListChecks} variant="default" compact />
            <StatCard title="Aprovados" value={report.passed} icon={CheckCircle2} variant="success" compact />
            <StatCard title="Falhas" value={report.failed} icon={ShieldX} variant="destructive" compact />
            <StatCard title="Alertas" value={report.warnings} icon={AlertTriangle} variant="warning" compact />
          </div>
        </div>

        <div>
          {report.categories.map((category, index) => (
            <CategorySection key={`${category.name}-${index}`} category={category} index={index} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
