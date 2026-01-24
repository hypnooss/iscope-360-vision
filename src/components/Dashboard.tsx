import { useState } from 'react';
import { ComplianceReport, CVEInfo } from '@/types/compliance';
import { ScoreGauge } from './ScoreGauge';
import { StatCard } from './StatCard';
import { CategorySection } from './CategorySection';
import { CVESection } from './CVESection';
import { CheckCircle, XCircle, AlertTriangle, ListChecks, RefreshCw, FileText, Shield, Globe, Cpu, Server, Hash, Clock, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { exportReportToPDF } from '@/utils/pdfExport';
import { toast } from 'sonner';

interface DashboardProps {
  report: ComplianceReport;
  onRefresh: () => void;
  isRefreshing: boolean;
  firewallName?: string;
  firewallUrl?: string;
}

export function Dashboard({ report, onRefresh, isRefreshing, firewallName, firewallUrl }: DashboardProps) {
  const [loadedCVEs, setLoadedCVEs] = useState<CVEInfo[]>([]);

  const handleCVEsLoaded = (cves: CVEInfo[]) => {
    setLoadedCVEs(cves);
  };

  const handleExportPDF = () => {
    try {
      const reportWithCVEs = { ...report, cves: loadedCVEs };
      exportReportToPDF(reportWithCVEs);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

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
            <Button variant="outline" size="lg" onClick={handleExportPDF}>
              <FileText className="w-4 h-4" />
              Exportar PDF
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

        {/* Score and Firewall Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1 glass-card rounded-xl p-6 flex items-center justify-center">
            <ScoreGauge score={report.overallScore} />
          </div>
          
          {/* Firewall Info - lado direito do score */}
          <div className="lg:col-span-2 glass-card rounded-xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              {/* Fortinet Badge */}
              <div className="hidden sm:flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg border border-primary/30">
                <ShieldCheck className="w-10 h-10 text-primary mb-1" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">FortiGate</span>
              </div>
              
              {/* Info Grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">Nome:</span>
                  <span className="font-semibold text-foreground truncate">{firewallName || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">FortiOS:</span>
                  <span className="font-medium text-foreground">v{report.firmwareVersion || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">URL:</span>
                  <span className="font-medium text-foreground text-sm truncate">{firewallUrl || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">Modelo:</span>
                  <span className="font-medium text-foreground">{report.systemInfo?.model || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">Serial:</span>
                  <span className="font-medium text-foreground font-mono text-sm">{report.systemInfo?.serial || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground text-sm">Análise:</span>
                  <span className="font-medium text-foreground text-sm">
                    {report.generatedAt instanceof Date 
                      ? report.generatedAt.toLocaleDateString('pt-BR')
                      : new Date(report.generatedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total de Verificações"
            value={report.totalChecks}
            icon={ListChecks}
            variant="default"
            delay={0.1}
          />
          <StatCard
            title="Aprovadas"
            value={report.passed}
            icon={CheckCircle}
            variant="success"
            delay={0.2}
          />
          <StatCard
            title="Falhas"
            value={report.failed}
            icon={XCircle}
            variant="destructive"
            delay={0.3}
          />
          <StatCard
            title="Alertas"
            value={report.warnings}
            icon={AlertTriangle}
            variant="warning"
            delay={0.4}
          />
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
          {Array.isArray(report.categories) && report.categories.length > 0 ? (
            report.categories.map((category, index) => (
              <CategorySection key={category.name} category={category} index={index} />
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
