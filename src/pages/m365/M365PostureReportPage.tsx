import { useEffect, useMemo, useState, ReactNode } from 'react';
import 'flag-icons/css/flag-icons.min.css';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useModules } from '@/contexts/ModuleContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { ScoreGauge } from '@/components/ScoreGauge';
import { M365CategorySection } from '@/components/m365/posture/M365CategorySection';
import { Loader2, ArrowLeft, AlertTriangle, FileDown, RefreshCw, XCircle } from 'lucide-react';
import { formatDateTimeBR } from '@/lib/dateUtils';
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
// DetailRow: Structured info row with label and value + subValue support
// ─────────────────────────────────────────────────────────────────────────────

interface DetailRowProps {
  label: string;
  value: string | number | ReactNode;
  subValue?: string;
  indicator?: "success" | "warning" | "error";
  highlight?: boolean;
}

function DetailRow({ label, value, subValue, indicator, highlight }: DetailRowProps) {
  const indicatorStyles = {
    success: "bg-emerald-400 shadow-[0_0_6px_hsl(142_76%_60%/0.5)]",
    warning: "bg-amber-400 shadow-[0_0_6px_hsl(38_92%_50%/0.5)]",
    error: "bg-rose-400 shadow-[0_0_6px_hsl(0_72%_60%/0.5)]",
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          {indicator && (
            <span 
              className={cn(
                "inline-block w-2 h-2 rounded-full mr-2",
                indicatorStyles[indicator]
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
        {subValue && (
          <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Country flag helper with name-to-ISO normalization
// ─────────────────────────────────────────────────────────────────────────────

function normalizeCountryCode(country: string): string {
  if (!country) return '';
  
  // If already a 2-letter ISO code
  if (country.length === 2 && /^[A-Z]{2}$/i.test(country)) {
    return country.toUpperCase();
  }
  
  // Map common country names to ISO codes (Microsoft Graph returns full names)
  const nameToCode: Record<string, string> = {
    'brazil': 'BR',
    'brasil': 'BR',
    'united states': 'US',
    'usa': 'US',
    'portugal': 'PT',
    'united kingdom': 'GB',
    'uk': 'GB',
    'germany': 'DE',
    'deutschland': 'DE',
    'france': 'FR',
    'spain': 'ES',
    'españa': 'ES',
    'italy': 'IT',
    'italia': 'IT',
    'netherlands': 'NL',
    'canada': 'CA',
    'australia': 'AU',
    'japan': 'JP',
    'china': 'CN',
    'india': 'IN',
    'mexico': 'MX',
    'méxico': 'MX',
    'argentina': 'AR',
    'chile': 'CL',
    'colombia': 'CO',
    'peru': 'PE',
    'perú': 'PE',
    'russia': 'RU',
    'south africa': 'ZA',
    'ireland': 'IE',
    'switzerland': 'CH',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'belgium': 'BE',
    'austria': 'AT',
    'poland': 'PL',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'south korea': 'KR',
    'korea': 'KR',
    'singapore': 'SG',
    'hong kong': 'HK',
    'taiwan': 'TW',
    'israel': 'IL',
    'united arab emirates': 'AE',
    'uae': 'AE',
    'saudi arabia': 'SA',
    'new zealand': 'NZ',
    'egypt': 'EG',
    'turkey': 'TR',
    'greece': 'GR',
    'ukraine': 'UA',
    'romania': 'RO',
    'hungary': 'HU',
    'thailand': 'TH',
    'vietnam': 'VN',
    'philippines': 'PH',
    'indonesia': 'ID',
    'malaysia': 'MY',
    'nigeria': 'NG',
    'kenya': 'KE',
    'morocco': 'MA',
    'uruguay': 'UY',
    'paraguay': 'PY',
    'ecuador': 'EC',
    'venezuela': 'VE',
    'bolivia': 'BO',
    'costa rica': 'CR',
    'panama': 'PA',
    'puerto rico': 'PR',
    'dominican republic': 'DO',
    'cuba': 'CU',
    'guatemala': 'GT',
    'honduras': 'HN',
    'el salvador': 'SV',
    'nicaragua': 'NI',
    'jamaica': 'JM',
  };
  
  return nameToCode[country.toLowerCase()] || '';
}

function getCountryFlag(countryInput: string): string {
  if (!countryInput) return '🌍';
  
  const code = normalizeCountryCode(countryInput);
  
  // Validate we have a proper 2-letter ISO code
  if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
    // Generate flag emoji dynamically using Unicode Regional Indicator Symbols
    // 'BR' → 🇧🇷 (B=0x1F1E7, R=0x1F1F7)
    const codePoints = [...code].map(
      char => 0x1F1E6 - 65 + char.charCodeAt(0)
    );
    return String.fromCodePoint(...codePoints);
  }
  
  return '🌍';
}

// Get full country name from ISO code
function getCountryName(countryCode: string): string {
  const codeToName: Record<string, string> = {
    'BR': 'Brasil',
    'US': 'Estados Unidos',
    'PT': 'Portugal',
    'GB': 'Reino Unido',
    'UK': 'Reino Unido',
    'DE': 'Alemanha',
    'FR': 'França',
    'ES': 'Espanha',
    'IT': 'Itália',
    'NL': 'Países Baixos',
    'CA': 'Canadá',
    'AU': 'Austrália',
    'JP': 'Japão',
    'CN': 'China',
    'IN': 'Índia',
    'MX': 'México',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colômbia',
    'PE': 'Peru',
    'RU': 'Rússia',
    'ZA': 'África do Sul',
    'IE': 'Irlanda',
    'CH': 'Suíça',
    'SE': 'Suécia',
    'NO': 'Noruega',
    'DK': 'Dinamarca',
    'FI': 'Finlândia',
    'BE': 'Bélgica',
    'AT': 'Áustria',
    'PL': 'Polônia',
    'CZ': 'Tchéquia',
    'KR': 'Coreia do Sul',
    'SG': 'Singapura',
    'HK': 'Hong Kong',
    'TW': 'Taiwan',
    'IL': 'Israel',
    'AE': 'Emirados Árabes',
    'SA': 'Arábia Saudita',
    'NZ': 'Nova Zelândia',
    'EG': 'Egito',
    'TR': 'Turquia',
    'GR': 'Grécia',
    'UA': 'Ucrânia',
    'RO': 'Romênia',
    'HU': 'Hungria',
    'TH': 'Tailândia',
    'VN': 'Vietnã',
    'PH': 'Filipinas',
    'ID': 'Indonésia',
    'MY': 'Malásia',
    'NG': 'Nigéria',
    'KE': 'Quênia',
    'MA': 'Marrocos',
    'UY': 'Uruguai',
    'PY': 'Paraguai',
    'EC': 'Equador',
    'VE': 'Venezuela',
    'BO': 'Bolívia',
    'CR': 'Costa Rica',
    'PA': 'Panamá',
    'PR': 'Porto Rico',
    'DO': 'República Dominicana',
    'CU': 'Cuba',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'SV': 'El Salvador',
    'NI': 'Nicarágua',
    'JM': 'Jamaica',
    'LU': 'Luxemburgo',
  };
  
  const code = countryCode.toUpperCase();
  return codeToName[code] || code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface EnvironmentMetrics {
  authType: 'cloud_only' | 'hybrid' | 'federated';
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  guestUsers: number;
  mfaEnabledPercent: number;
  conditionalAccessEnabled: boolean;
  conditionalAccessPoliciesCount: number;
  securityDefaultsEnabled: boolean;
  enterpriseAppsCount: number;
  appRegistrationsCount: number;
  storageUsedGB: number;
  storageTotalGB: number;
  loginCountries: Array<{ country: string; success: number; fail: number; count?: number }>;
}

interface PostureData {
  id: string;
  score: number;
  classification: string;
  summary: any;
  category_breakdown: any[];
  insights: any[];
  environment_metrics: EnvironmentMetrics | null;
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
        .select('id, score, classification, summary, category_breakdown, insights, environment_metrics, created_at, tenant_record_id, client_id')
        .eq('id', reportId)
        .eq('status', 'completed')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Report not found');

      // Parse environment metrics from insights if stored there
      const rawData = data as any;
      
      return {
        ...rawData,
        environment_metrics: rawData.environment_metrics || null,
      } as PostureData;
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

  // Use environment metrics from API or fallback to parsing insights
  const envMetrics = useMemo((): EnvironmentMetrics => {
    // If we have environment_metrics from the API, use it
    if (reportData?.environment_metrics) {
      return reportData.environment_metrics;
    }
    
    // Fallback: extract from insights (for older reports)
    const fallback: EnvironmentMetrics = {
      authType: 'cloud_only',
      totalUsers: 0,
      activeUsers: 0,
      disabledUsers: 0,
      guestUsers: 0,
      mfaEnabledPercent: 0,
      conditionalAccessEnabled: false,
      conditionalAccessPoliciesCount: 0,
      securityDefaultsEnabled: false,
      enterpriseAppsCount: 0,
      appRegistrationsCount: 0,
      storageUsedGB: 0,
      storageTotalGB: 0,
      loginCountries: [],
    };
    
    insights.forEach((insight: any) => {
      // IDT-001: "X de Y usuário(s) sem MFA" → Y = total de usuários, calculate MFA %
      if (insight.id === 'IDT-001') {
        const match = insight.descricaoExecutiva?.match(/(\d+) de (\d+) usuário/);
        if (match) {
          const withoutMfa = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          fallback.totalUsers = total;
          fallback.activeUsers = total;
          fallback.mfaEnabledPercent = total > 0 ? Math.round(((total - withoutMfa) / total) * 100) : 0;
        }
      }
      
      // IDT-003 ou IDT-004: guests count
      if (insight.id === 'IDT-003' || insight.id === 'IDT-004') {
        const count = insight.affectedCount || 0;
        if (count > fallback.guestUsers) fallback.guestUsers = count;
      }
      
      // IDT-006: disabled users
      if (insight.id === 'IDT-006') {
        fallback.disabledUsers = insight.affectedCount || 0;
      }
      
      // ADM-003: privileged users count
      if (insight.id === 'ADM-003') {
        // This is privileged users, not global admins
      }
      
      // AUT-001: Check for CA policies
      if (insight.id === 'AUT-001') {
        fallback.conditionalAccessEnabled = insight.status === 'pass';
        fallback.conditionalAccessPoliciesCount = insight.affectedCount || 0;
      }
    });
    
    return fallback;
  }, [reportData, insights]);

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
          <div>
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Análise de Compliance</h1>
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
                        {/* Unified ScoreGauge with premium design */}
                        <ScoreGauge 
                          score={reportData.score} 
                          size="lg" 
                        />
                      </div>

                      {/* Mini Stats Row */}
                      <div className="flex gap-3 mt-14">
                        <MiniStat value={totalChecks} label="Total" variant="primary" />
                        <MiniStat value={passedCount} label="Aprovadas" variant="success" />
                        <MiniStat value={failedCount} label="Falhas" variant="destructive" />
                      </div>
                    </div>

                    {/* Right Panel: Environment Info */}
                    <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                      {/* Identity Block */}
                      <DetailRow label="Domínio" value={displayInfo.tenant_domain || 'N/A'} highlight />
                      <DetailRow 
                        label="Tipo Auth" 
                        value={
                          envMetrics.authType === 'hybrid' ? 'Hybrid (AD Connect)' :
                          envMetrics.authType === 'federated' ? 'Federation (ADFS)' :
                          'Cloud Only'
                        } 
                      />
                      
                      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-3" />
                      
                      {/* Users Block */}
                      <DetailRow 
                        label="Usuários" 
                        value={envMetrics.activeUsers > 0 ? `${envMetrics.activeUsers} ativos` : 'N/A'}
                        subValue={envMetrics.activeUsers > 0 
                          ? `${envMetrics.disabledUsers} inativos, ${envMetrics.guestUsers} guests`
                          : undefined
                        }
                      />
                      <DetailRow 
                        label="Aplicações" 
                        value={envMetrics.enterpriseAppsCount > 0 || envMetrics.appRegistrationsCount > 0
                          ? `Empresariais: ${envMetrics.enterpriseAppsCount} | Apps: ${envMetrics.appRegistrationsCount}`
                          : 'N/A'
                        }
                      />
                      
                      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-3" />
                      
                      {/* Security Block */}
                      <DetailRow 
                        label="MFA" 
                        value={`${envMetrics.mfaEnabledPercent}% habilitado`}
                        indicator={envMetrics.mfaEnabledPercent >= 80 ? "success" : envMetrics.mfaEnabledPercent >= 50 ? "warning" : "error"}
                      />
                      <DetailRow 
                        label="Cond. Access" 
                        value={envMetrics.conditionalAccessEnabled 
                          ? `${envMetrics.conditionalAccessPoliciesCount} política(s) ativa(s)` 
                          : 'Não configurado'}
                        indicator={envMetrics.conditionalAccessEnabled ? "success" : "error"}
                      />
                      
                      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent my-3" />
                      
                      {/* Login Countries */}
                      <DetailRow 
                        label="Origem Auth" 
                        value={envMetrics.loginCountries && envMetrics.loginCountries.length > 0 
                          ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {envMetrics.loginCountries.slice(0, 5).map((c, idx) => {
                                const code = normalizeCountryCode(c.country);
                                const name = getCountryName(code || c.country);
                                const flagCode = code.toLowerCase();
                                // Check if new format (success/fail) or old format (count)
                                const hasNewFormat = typeof c.success === 'number';
                                const countDisplay = hasNewFormat 
                                  ? `(${c.success}/${c.fail})`
                                  : c.count ? `(${c.count})` : '';
                                return (
                                  <span key={idx} className="inline-flex items-center gap-1.5">
                                    <span className={`fi fi-${flagCode} rounded-sm`} style={{ fontSize: '1rem' }} />
                                    <span>{name}</span>
                                    {countDisplay && (
                                      <span className="text-muted-foreground text-xs">{countDisplay}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )
                          : 'N/A'
                        }
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
                    items={insights.filter((i: any) => i.category === cat.category)}
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
