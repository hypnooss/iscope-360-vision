import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { M365ScoreGauge } from '@/components/m365/posture/M365ScoreGauge';
import { M365CategorySection } from '@/components/m365/posture/M365CategorySection';
import { Loader2, ArrowLeft, AlertTriangle, FileDown, RefreshCw, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, M365RiskCategory } from '@/types/m365Insights';

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
  value: string | number;
  indicator?: "success" | "error";
  highlight?: boolean;
}

function DetailRow({ label, value, indicator, highlight }: DetailRowProps) {
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <div className="flex-1 min-w-0 flex items-center">
          {indicator && (
            <span 
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2",
                indicator === "success" 
                  ? "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]" 
                  : "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]"
              )} 
            />
          )}
          <span 
            className={cn(
              "text-sm font-medium",
              highlight ? "text-primary" : "text-foreground"
            )}
          >
            {value}
          </span>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface PostureData {
  id: string;
  score: number;
  classification: string;
  summary: any;
  category_breakdown: any[];
  insights: any[];
  created_at: string;
  tenant_record_id: string;
  client_id: string;
}

export default function M365PostureReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hasModuleAccess, loading: moduleLoading } = useModules();

  const tenantMeta = location.state?.tenantMeta;

  useEffect(() => {
    if (authLoading || moduleLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!hasModuleAccess('scope_m365')) {
      navigate('/modules');
    }
  }, [user, authLoading, moduleLoading, navigate, hasModuleAccess]);

  // Fetch report data
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['m365-posture-report', reportId],
    queryFn: async () => {
      if (!reportId) throw new Error('Report ID is required');

      const { data, error } = await supabase
        .from('m365_posture_history')
        .select('id, score, classification, summary, category_breakdown, insights, created_at, tenant_record_id, client_id')
        .eq('id', reportId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Report not found');

      return data as PostureData;
    },
    enabled: !!reportId && !!user,
  });

  // Fetch tenant and client info if not passed via state
  const { data: tenantInfo } = useQuery({
    queryKey: ['m365-tenant-info', reportData?.tenant_record_id],
    queryFn: async () => {
      if (!reportData?.tenant_record_id) return null;

      const { data: tenant } = await supabase
        .from('m365_tenants')
        .select('display_name, tenant_domain')
        .eq('id', reportData.tenant_record_id)
        .maybeSingle();

      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', reportData.client_id)
        .maybeSingle();

      return {
        tenant_name: tenant?.display_name || tenant?.tenant_domain || 'N/A',
        tenant_domain: tenant?.tenant_domain,
        client_name: client?.name || 'N/A',
      };
    },
    enabled: !!reportData && !tenantMeta,
  });

  const displayInfo = tenantMeta || tenantInfo || {};

  // Memoize categories and insights
  const categories = useMemo(() => {
    return reportData?.category_breakdown || [];
  }, [reportData]);

  const insights = useMemo(() => {
    return reportData?.insights || [];
  }, [reportData]);

  // Summary stats
  const summary = useMemo(() => {
    return {
      critical: reportData?.summary?.critical || 0,
      high: reportData?.summary?.high || 0,
      medium: reportData?.summary?.medium || 0,
      low: reportData?.summary?.low || 0,
      total: reportData?.summary?.total || 0,
    };
  }, [reportData]);

  const totalChecks = insights.length;
  const passedCount = insights.filter((i: any) => i.status === 'pass').length;
  const failedCount = insights.filter((i: any) => i.status === 'fail').length;

  // Critical count for banner
  const criticalCount = insights.filter((i: any) => i.status === 'fail' && i.severity === 'critical').length;

  if (authLoading || moduleLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !reportData) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8">
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Relatório não encontrado</h2>
            <p className="text-muted-foreground mb-4">O relatório solicitado não existe ou você não tem permissão.</p>
            <Button onClick={() => navigate('/scope-m365/reports')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Relatórios
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <PageBreadcrumb items={[
          { label: 'Microsoft 365', href: '/scope-m365/tenants' },
          { label: 'Relatórios', href: '/scope-m365/reports' },
          { label: displayInfo.tenant_name || 'Relatório' },
        ]} />

        <div className="pt-6 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Análise de Postura</h1>
                <p className="text-muted-foreground">
                  Relatório gerado em {format(new Date(reportData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              <div className="flex gap-3 ml-auto">
                <Button variant="outline" size="lg" disabled>
                  <FileDown className="w-4 h-4" />
                  Exportar PDF
                </Button>
                <Button variant="cyber" size="lg" disabled>
                  <RefreshCw className="w-4 h-4" />
                  Reanalisar
                </Button>
              </div>
            </div>

            {/* COMMAND CENTER HEADER */}
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
                      {displayInfo.tenant_name || 'Microsoft 365'}
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
                        {/* Keep the M365ScoreGauge (dark style with shadow) */}
                        <M365ScoreGauge 
                          score={reportData.score} 
                          classification={reportData.classification as any} 
                          size="lg" 
                        />
                      </div>

                      {/* Mini Stats Row */}
                      <div className="flex gap-3 mt-6">
                        <MiniStat value={totalChecks} label="Total" variant="primary" />
                        <MiniStat value={passedCount} label="Aprovadas" variant="success" />
                        <MiniStat value={failedCount} label="Falhas" variant="destructive" />
                      </div>
                    </div>

                    {/* Right Panel: Details */}
                    <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                      <DetailRow label="Workspace" value={displayInfo.client_name || 'N/A'} />
                      <DetailRow label="Domínio" value={displayInfo.tenant_domain || 'N/A'} highlight />
                      <DetailRow 
                        label="Data" 
                        value={format(new Date(reportData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} 
                      />
                      
                      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-2" />
                      
                      {/* Severity breakdown */}
                      <DetailRow 
                        label="Críticos" 
                        value={`${summary.critical} ${summary.critical === 1 ? 'problema' : 'problemas'}`}
                        indicator={summary.critical > 0 ? "error" : "success"}
                      />
                      <DetailRow 
                        label="Alta" 
                        value={`${summary.high} ${summary.high === 1 ? 'problema' : 'problemas'}`}
                        indicator={summary.high > 0 ? "error" : "success"}
                      />
                      <DetailRow 
                        label="Média" 
                        value={`${summary.medium} ${summary.medium === 1 ? 'problema' : 'problemas'}`}
                      />
                      <DetailRow 
                        label="Baixa" 
                        value={`${summary.low} ${summary.low === 1 ? 'problema' : 'problemas'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical banner - only shows for critical severity items */}
            {criticalCount > 0 && (
              <div className="glass-card rounded-xl p-4 mb-8 border-destructive/50 bg-destructive/5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <XCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive">
                      {criticalCount} {criticalCount === 1 ? 'problema crítico encontrado' : 'problemas críticos encontrados'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Revise as falhas abaixo e aplique as correções recomendadas.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Categories with collapsible sections */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground mb-4">Verificações por Categoria</h2>
              {categories.length > 0 ? (
                categories.map((cat: any, index: number) => (
                  <M365CategorySection
                    key={cat.category}
                    category={cat.category}
                    label={CATEGORY_LABELS[cat.category as M365RiskCategory] || cat.label || cat.category}
                    insights={insights.filter((i: any) => i.category === cat.category)}
                    index={index}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhuma categoria encontrada neste relatório.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
