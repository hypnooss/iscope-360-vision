import { useState, useMemo } from 'react';
import { ComplianceReport, CVEInfo } from '@/types/compliance';
import { ScoreGauge } from './ScoreGauge';
import { CategorySection } from './CategorySection';
import { CVESection } from './CVESection';
import { XCircle, RefreshCw, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { usePDFDownload, sanitizePDFFilename, getPDFDateString } from '@/hooks/usePDFDownload';
import { FirewallPDF } from '@/components/pdf/FirewallPDF';
import { CategoryConfig } from '@/hooks/useCategoryConfig';
import { cn } from '@/lib/utils';

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
    destructive: { text: "text-rose-400", border: "border-rose-500/30", bg: "bg-rose-500/10" }
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
  highlight?: boolean;
}

function DetailRow({ label, value, highlight }: DetailRowProps) {
  const isMultiline = Array.isArray(value);
  
  return (
    <div className="group">
      <div className="flex items-start gap-3 py-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0 uppercase tracking-wide pt-0.5">
          {label}
        </span>
        <div className="flex-1 min-w-0">
          {isMultiline ? (
            <div className="space-y-0.5">
              {value.map((v, i) => (
                <div key={i} className={cn("text-sm font-medium", highlight ? "text-primary" : "text-foreground")}>
                  {v}
                </div>
              ))}
            </div>
          ) : (
            <span className={cn("text-sm font-medium truncate block", highlight ? "text-primary" : "text-foreground")}>
              {value}
            </span>
          )}
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-border/50 via-border/20 to-transparent" />
    </div>
  );
}

interface DashboardProps {
  report: ComplianceReport;
  onRefresh: () => void;
  isRefreshing: boolean;
  firewallName?: string;
  firewallUrl?: string;
  deviceVendor?: string | null;
  clientName?: string | null;
  categoryConfigs?: CategoryConfig[];
  skipGaugeAnimation?: boolean;
}

export function Dashboard({ report, onRefresh, isRefreshing, firewallName, firewallUrl, deviceVendor, clientName, categoryConfigs, skipGaugeAnimation = false }: DashboardProps) {
  const [loadedCVEs, setLoadedCVEs] = useState<CVEInfo[]>([]);
  const { downloadPDF, isGenerating: isExportingPDF } = usePDFDownload();

  // Sort categories by display_order from configs
  const sortedCategories = useMemo(() => {
    if (!report.categories) return [];
    return [...report.categories].sort((a, b) => {
      const configA = categoryConfigs?.find(c => c.name === a.name);
      const configB = categoryConfigs?.find(c => c.name === b.name);
      return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
    });
  }, [report.categories, categoryConfigs]);

  const handleCVEsLoaded = (cves: CVEInfo[]) => {
    setLoadedCVEs(cves);
  };

  const handleExportPDF = async () => {
    try {
      const filename = `iscope360-${sanitizePDFFilename(firewallName || 'firewall')}-${getPDFDateString()}.pdf`;
      
      await downloadPDF(
        <FirewallPDF
          report={{ ...report, categories: sortedCategories }}
          deviceInfo={{
            name: firewallName || 'Firewall',
            url: firewallUrl,
            vendor: deviceVendor || undefined,
            clientName: clientName || undefined,
          }}
          categoryConfigs={categoryConfigs}
        />,
        filename
      );
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  // Determine vendor label
  const vendorSource = deviceVendor?.toLowerCase() || report.systemInfo?.vendor?.toLowerCase() || '';
  const isSonicWall = vendorSource.includes('sonicwall') || vendorSource.includes('sonic');
  const osLabel = isSonicWall ? 'SonicOS' : 'FortiOS';

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Análise de Compliance
            </h1>
            <p className="text-muted-foreground">
              Relatório gerado em {report.generatedAt instanceof Date 
                ? report.generatedAt.toLocaleString('pt-BR')
                : new Date(report.generatedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" size="lg" onClick={handleExportPDF} disabled={isExportingPDF}>
              <FileText className={`w-4 h-4 ${isExportingPDF ? 'animate-pulse' : ''}`} />
              {isExportingPDF ? 'Gerando...' : 'Exportar PDF'}
            </Button>
            <Button 
              variant="cyber" 
              size="lg" 
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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
                  {firewallName || 'Firewall'}
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
                    <ScoreGauge score={report.overallScore} size={180} skipAnimation={skipGaugeAnimation} />
                  </div>

                  {/* Mini Stats Row */}
                  <div className="flex gap-3 mt-6">
                    <MiniStat value={report.totalChecks} label="Total" variant="primary" />
                    <MiniStat value={report.passed} label="Aprovadas" variant="success" />
                    <MiniStat value={report.failed} label="Falhas" variant="destructive" />
                  </div>
                </div>

                {/* Right Panel: Firewall Details */}
                <div className="flex flex-col justify-center lg:border-l lg:border-border/30 lg:pl-8">
                  <DetailRow label="Modelo" value={report.systemInfo?.model || 'N/A'} />
                  <DetailRow label="Serial" value={report.systemInfo?.serial || 'N/A'} />
                  <DetailRow label={osLabel} value={report.firmwareVersion ? `v${report.firmwareVersion}` : 'N/A'} />
                  <DetailRow label="Hostname" value={report.systemInfo?.hostname || firewallName || 'N/A'} />
                  <DetailRow label="Uptime" value={report.systemInfo?.uptime || 'N/A'} />
                  <DetailRow label="URL" value={firewallUrl || 'N/A'} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Issues Banner */}
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
                <p className="text-sm text-muted-foreground">
                  Revise as falhas abaixo e aplique as correções recomendadas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CVE Section */}
        {report.firmwareVersion && (
          <div className="mb-8">
            <CVESection 
              firmwareVersion={report.firmwareVersion} 
              onCVEsLoaded={handleCVEsLoaded}
            />
          </div>
        )}

        {/* Categories */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Verificações por Categoria
          </h2>
          {Array.isArray(sortedCategories) && sortedCategories.length > 0 ? (
            sortedCategories.map((category, index) => (
              <CategorySection key={category.name} category={category} index={index} categoryConfigs={categoryConfigs} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma categoria de verificação disponível.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
