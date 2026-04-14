import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown, ShieldAlert, Globe, Radar } from 'lucide-react';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { ExternalDomainPDFDemo } from '@/components/pdf/ExternalDomainPDFDemo';
import { SurfaceAnalyzerPDFDemo } from '@/components/pdf/SurfaceAnalyzerPDFDemo';
import { formatDateTimeBR } from '@/lib/dateUtils';
import type { ComplianceCategory, ComplianceReport } from '@/types/compliance';
import type { AttackSurfaceSnapshot } from '@/hooks/useAttackSurfaceData';

// ── Helpers ──

const getIconForCategory = (name: string): string => {
  const icons: Record<string, string> = {
    'Administração': 'Settings', 'Autenticação': 'Key', 'Logging': 'FileText',
    'Rede': 'Network', 'Segurança': 'Shield', 'Sistema': 'Server',
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
    categories = (categories as any[]).map(cat => ({
      ...cat,
      icon: cat.icon || getIconForCategory(cat.name),
      checks: (cat.checks || []).map(normalizeCheck),
      passRate: cat.passRate ?? calculatePassRate((cat.checks || []).map(normalizeCheck) as { status: string }[]),
    }));
  } else {
    categories = [];
  }

  const allChecks = (raw.checks as { status: string }[])
    ?? (categories as ComplianceCategory[])?.flatMap(c => c.checks) ?? [];

  return {
    overallScore: (raw.overallScore as number) ?? (raw.score as number) ?? 0,
    totalChecks: allChecks.length,
    passed: allChecks.filter(c => c.status === 'pass').length,
    failed: allChecks.filter(c => c.status === 'fail').length,
    warnings: allChecks.filter(c => c.status === 'warn' || c.status === 'warning').length,
    categories: categories as ComplianceCategory[],
    generatedAt: new Date(createdAt || (raw.generatedAt as string) || Date.now()),
    subdomainSummary: (raw.subdomain_summary as any) ? {
      total_found: (raw.subdomain_summary as any).total_found ?? 0,
      subdomains: (raw.subdomain_summary as any).subdomains ?? [],
      sources: (raw.subdomain_summary as any).sources ?? [],
      mode: (raw.subdomain_summary as any).mode ?? 'passive',
    } : undefined,
  };
};

const parseSnapshot = (row: Record<string, unknown>): AttackSurfaceSnapshot => ({
  id: row.id as string,
  client_id: row.client_id as string,
  status: (row.status as string) ?? 'pending',
  source_ips: (Array.isArray(row.source_ips) ? row.source_ips : []) as any,
  results: (row.results ?? {}) as any,
  cve_matches: (Array.isArray(row.cve_matches) ? row.cve_matches : []) as any,
  summary: (row.summary ?? { total_ips: 0, open_ports: 0, services: 0, cves: 0 }) as any,
  score: row.score as number | null,
  created_at: row.created_at as string,
  completed_at: row.completed_at as string | null,
});

// ── Main Page ──

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [domainName, setDomainName] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [surfaceSnapshot, setSurfaceSnapshot] = useState<AttackSurfaceSnapshot | null>(null);

  const { downloadPDF, isGenerating } = usePDFDownload();

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      setLoading(false);
      return;
    }
    fetchReportData();
  }, [token]);

  const fetchReportData = async () => {
    try {
      const { data: job, error: jobErr } = await supabase
        .from('api_jobs')
        .select('id, domain_id, metadata, status, steps, client_id')
        .eq('access_token', token!)
        .eq('status', 'completed')
        .maybeSingle();

      if (jobErr || !job) {
        setError('Relatório não encontrado ou expirado.');
        setLoading(false);
        return;
      }

      setJobData(job);

      // Fetch domain info + analysis + attack surface in parallel
      const promises: Promise<void>[] = [];

      if (job.domain_id) {
        promises.push(
          Promise.resolve(
            supabase
              .from('external_domains')
              .select('domain')
              .eq('id', job.domain_id)
              .maybeSingle()
          ).then(({ data }) => { if (data) setDomainName(data.domain); })
        );

        promises.push(
          Promise.resolve(
            supabase
              .from('external_domain_analysis_history')
              .select('id, score, report_data, created_at')
              .eq('domain_id', job.domain_id)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
          ).then(({ data }) => { if (data) setAnalysisData(data); })
        );
      }

      // Fetch attack surface snapshot for this client
      if (job.client_id) {
        promises.push(
          (supabase
            .from('attack_surface_snapshots' as any)
            .select('*')
            .eq('client_id', job.client_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1) as any)
            .then(({ data }: any) => {
              const rows = (data as any[]) || [];
              if (rows.length > 0) setSurfaceSnapshot(parseSnapshot(rows[0]));
            })
        );
      }

      await Promise.all(promises);
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar relatório.');
      setLoading(false);
    }
  };

  const report = useMemo(() => {
    if (!analysisData?.report_data) return null;
    return normalizeReportData(analysisData.report_data, analysisData.created_at);
  }, [analysisData]);

  const handleDownloadCompliance = async () => {
    if (!report) return;
    const filename = `iscope360-compliance-${sanitizePDFFilename(domainName)}-${getPDFDateString()}.pdf`;
    await downloadPDF(
      <ExternalDomainPDFDemo
        report={report}
        domainInfo={{ name: domainName, domain: domainName }}
      />,
      filename
    );
  };

  const handleDownloadSurface = async () => {
    if (!surfaceSnapshot) return;
    const dateStr = formatDateTimeBR(new Date(surfaceSnapshot.created_at));
    const filename = `iscope360-surface-${sanitizePDFFilename(domainName)}-${getPDFDateString()}.pdf`;
    await downloadPDF(
      <SurfaceAnalyzerPDFDemo
        snapshot={surfaceSnapshot}
        domainName={domainName}
        dateString={dateStr}
      />,
      filename
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Relatório indisponível</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">iScope360</h1>
              <p className="text-sm text-muted-foreground">Domain Security Report</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Domínio</p>
                <p className="text-lg font-semibold font-mono text-foreground">{domainName}</p>
              </div>
              {report && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
                  <p className="text-2xl font-bold text-primary">{report.overallScore}/100</p>
                </div>
              )}
            </div>

            {report && (
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">
                  {report.totalChecks} verificações · {report.passed} ok · {report.failed} falhas
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {(report || surfaceSnapshot) ? (
          <div className="space-y-6">
            {/* Compliance PDF Download */}
            {report && (
              <div className="bg-card border rounded-lg p-6 text-center space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  📄 Relatório de Compliance de Domínio
                </h2>
                <p className="text-sm text-muted-foreground">
                  Inclui resumo executivo, infraestrutura DNS e mapa de superfície.
                  O relatório completo contém guias de correção e plano de ação detalhado.
                </p>
                <Button
                  onClick={handleDownloadCompliance}
                  disabled={isGenerating}
                  size="lg"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {isGenerating ? 'Gerando PDF...' : 'Baixar PDF Compliance (Demo)'}
                </Button>
              </div>
            )}

            {/* Surface Analyzer PDF Download */}
            {surfaceSnapshot && (
              <div className="bg-card border rounded-lg p-6 text-center space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  🔍 Relatório de Superfície de Ataque
                </h2>
                <p className="text-sm text-muted-foreground">
                  Análise de IPs expostos, portas abertas, serviços e vulnerabilidades (CVEs).
                  A versão completa inclui detalhes de cada serviço e CVE encontrada.
                </p>
                <div className="flex gap-4 justify-center text-sm text-muted-foreground mb-2">
                  <span>{surfaceSnapshot.summary.total_ips} IPs</span>
                  <span>{surfaceSnapshot.summary.open_ports} Portas</span>
                  <span>{surfaceSnapshot.summary.services} Serviços</span>
                  <span>{surfaceSnapshot.summary.cves} CVEs</span>
                </div>
                <Button
                  onClick={handleDownloadSurface}
                  disabled={isGenerating}
                  size="lg"
                  variant="outline"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radar className="h-4 w-4" />
                  )}
                  {isGenerating ? 'Gerando PDF...' : 'Baixar PDF Surface Analyzer (Demo)'}
                </Button>
              </div>
            )}

            {/* Summary Cards */}
            {report && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {report.categories.map((cat) => (
                  <div key={cat.name} className="bg-card border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1 truncate">{cat.name}</p>
                    <p className="text-lg font-bold text-foreground">
                      {cat.passRate >= 0 ? `${cat.passRate}%` : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cat.checks.length} checks
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Dados do relatório não disponíveis.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/30 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Precisio · iScope360 · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
