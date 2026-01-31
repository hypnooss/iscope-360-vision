import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComplianceReport, ComplianceCheck, CVEInfo } from '@/types/compliance';

const getStatusText = (status: string) => {
  switch (status) {
    case 'pass': return 'Aprovado';
    case 'fail': return 'Falha';
    case 'warning': return 'Alerta';
    case 'pending': return 'Pendente';
    default: return status;
  }
};

const getSeverityText = (severity: string) => {
  switch (severity) {
    case 'critical': return 'Crítico';
    case 'high': return 'Alto';
    case 'medium': return 'Médio';
    case 'low': return 'Baixo';
    default: return severity;
  }
};

const getStatusColor = (status: string): [number, number, number] => {
  switch (status) {
    case 'pass': return [34, 197, 94]; // green
    case 'fail': return [220, 38, 38]; // red-600 (mais escuro para diferenciar)
    case 'warning': return [245, 158, 11]; // amber-500 (mais laranja para diferenciar de falha)
    default: return [107, 114, 128]; // gray
  }
};

const getSeverityColor = (severity: string): [number, number, number] => {
  switch (severity) {
    case 'critical': return [220, 38, 38]; // red-600
    case 'high': return [234, 88, 12]; // orange-600
    case 'medium': return [202, 138, 4]; // yellow-600
    case 'low': return [22, 163, 74]; // green-600
    default: return [107, 114, 128]; // gray
  }
};

// Calcular score ponderado por criticidade
function calculateWeightedScore(checks: ComplianceCheck[]): number {
  const weights = { critical: 5, high: 3, medium: 1, low: 1 };
  
  let totalWeight = 0;
  let passedWeight = 0;
  
  for (const check of checks) {
    const weight = weights[check.severity] || 1;
    totalWeight += weight;
    if (check.status === 'pass') {
      passedWeight += weight;
    }
  }
  
  return totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
}

// Obter classificação de risco baseado no score
function getRiskClassification(score: number): { label: string; color: [number, number, number] } {
  if (score >= 90) return { label: 'EXCELENTE', color: [34, 197, 94] };
  if (score >= 75) return { label: 'BOM', color: [74, 222, 128] };
  if (score >= 60) return { label: 'ATENÇÃO', color: [234, 179, 8] };
  return { label: 'RISCO ALTO', color: [239, 68, 68] };
}

// Sanitize text for PDF export - handles special characters
function sanitizeTextForPDF(text: string): string {
  if (!text) return '-';
  return text
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '-')
    .replace(/✓/g, '(OK)')
    .replace(/✗/g, '(X)')
    .replace(/✔/g, '(OK)')
    .replace(/✕/g, '(X)')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

// Descritivos de cada categoria de analise
const categoryDescriptions: Record<string, string> = {
  'Segurança de Interfaces': 'Verifica configuracoes de acesso as interfaces de gerenciamento, incluindo protocolos inseguros como HTTP e Telnet.',
  'Regras de Entrada': 'Analisa politicas de firewall que permitem trafego de entrada da internet, identificando exposicoes de servicos criticos.',
  'Configuração de Rede': 'Avalia configuracoes gerais de rede, incluindo regras permissivas e segmentacao.',
  'Políticas de Segurança': 'Examina configuracoes de autenticacao administrativa, incluindo 2FA, politicas de senha e timeout.',
  'Atualização de Firmware': 'Verifica a versao do FortiOS instalada e identifica atualizacoes disponiveis.',
  'Atualizações': 'Verifica a versao do FortiOS instalada e identifica atualizacoes disponiveis.',
  'Perfis de Segurança UTM': 'Analisa a aplicacao de perfis de seguranca (IPS, AV, WebFilter, AppControl) nas politicas.',
  'Configuração VPN': 'Avalia configuracoes de VPN IPSec e SSL VPN, incluindo algoritmos e certificados.',
  'Logging e Monitoramento': 'Verifica configuracoes de log e integracao com FortiAnalyzer/FortiCloud.',
  'Licenciamento': 'Verifica status do FortiCare e licencas FortiGuard (AV, IPS, WebFilter, AppControl).',
  'Recomendações': 'Sumario de recomendacoes com base na analise de conformidade, incluindo interfaces, politicas e perfis de seguranca.',
};

// Calcular cobertura UTM (baseado em políticas de saída internet)
function calculateUTMCoverage(report: ComplianceReport): { full: number; partial: number; total: number } {
  const utmCategory = report.categories.find(c => c.name === 'Perfis de Segurança UTM');
  if (!utmCategory) return { full: 0, partial: 0, total: 0 };
  
  // Extrair informações dos checks UTM
  const ipsCheck = utmCategory.checks.find(c => c.id === 'utm-001');
  const webFilterCheck = utmCategory.checks.find(c => c.id === 'utm-004');
  const appControlCheck = utmCategory.checks.find(c => c.id === 'utm-007');
  const avCheck = utmCategory.checks.find(c => c.id === 'utm-009');
  
  // Para WebFilter e AppControl, usar políticas de internet
  // Para IPS e AV, usar todas as políticas
  const totalInternetPolicies = Number(webFilterCheck?.rawData?.internetPolicies) || 0;
  const totalAllPolicies = Number(ipsCheck?.rawData?.total) || 0;
  
  // Usar o total de políticas de internet como base para UTM de saída
  const totalPolicies = totalInternetPolicies > 0 ? totalInternetPolicies : totalAllPolicies;
  
  // Contar cobertura UTM
  const webFilterCount = Number(webFilterCheck?.rawData?.withWebFilter) || 0;
  const appControlCount = Number(appControlCheck?.rawData?.withAppControl) || 0;
  const avCount = Number(avCheck?.rawData?.withAV) || 0;
  
  // Para políticas de saída internet: WebFilter + AppControl + AV
  // Cobertura completa = todos os 3 perfis aplicados
  const fullCoverage = Math.min(webFilterCount, appControlCount, avCount);
  
  // Políticas com pelo menos algum perfil UTM
  const maxCoverage = Math.max(webFilterCount, appControlCount, avCount);
  const partialCoverage = maxCoverage - fullCoverage;
  
  return { 
    full: fullCoverage, 
    partial: partialCoverage, 
    total: totalPolicies
  };
}

// Contar issues por severidade
function countBySeverity(report: ComplianceReport): { critical: number; high: number; medium: number; low: number } {
  const allChecks = report.categories.flatMap(c => c.checks);
  const failedAndWarning = allChecks.filter(c => c.status === 'fail' || c.status === 'warning');
  
  return {
    critical: failedAndWarning.filter(c => c.severity === 'critical').length,
    high: failedAndWarning.filter(c => c.severity === 'high').length,
    medium: failedAndWarning.filter(c => c.severity === 'medium').length,
    low: failedAndWarning.filter(c => c.severity === 'low').length,
  };
}

export function exportReportToPDF(
  report: ComplianceReport,
  deviceInfo?: {
    name?: string;
    url?: string;
    vendor?: string;
  }
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // Ensure generatedAt is a Date object
  const generatedAtDate = report.generatedAt instanceof Date 
    ? report.generatedAt 
    : new Date(report.generatedAt);

  // Determine device name and type for header
  const deviceName = deviceInfo?.name || report.systemInfo?.hostname || 'Dispositivo';
  const vendorSource = deviceInfo?.vendor?.toLowerCase() || report.systemInfo?.vendor?.toLowerCase() || '';
  const isSonicWall = vendorSource.includes('sonicwall') || vendorSource.includes('sonic');
  const vendorLabel = isSonicWall ? 'SonicWall' : 'FortiGate';

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 180, 180);
  doc.text(`Relatório de Compliance - ${deviceName}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${generatedAtDate.toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });

  // Device Info Block
  yPos += 10;
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(14, yPos - 3, pageWidth - 28, 28, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  
  // Device name with vendor badge
  doc.text(`${vendorLabel}: ${deviceName}`, 20, yPos + 5);
  
  // Model and Serial on same line
  const modelSerial = `Modelo: ${report.systemInfo?.model || 'N/A'} | Serial: ${report.systemInfo?.serial || 'N/A'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(modelSerial, 20, yPos + 12);
  
  // Firmware and Uptime
  const fwUptime = `Firmware: ${report.firmwareVersion || 'N/A'} | Uptime: ${report.systemInfo?.uptime || 'N/A'}`;
  doc.text(fwUptime, 20, yPos + 19);
  
  yPos += 32;

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1: Score de Compliance Geral (ponderado - mesmo do dashboard)
  // ═══════════════════════════════════════════════════════════════
  yPos += 18;
  
  const allChecks = report.categories.flatMap(c => c.checks);
  
  // O score do report já é ponderado (calculado na edge function)
  // Usar o mesmo score do dashboard para consistência
  const displayScore = report.overallScore;
  const riskClass = getRiskClassification(displayScore);
  
  // Box background
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(14, yPos - 5, 55, 45, 3, 3, 'F');
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('COMPLIANCE GERAL', 41.5, yPos + 2, { align: 'center' });
  
  // Score circle - usar displayScore (mesmo do dashboard)
  const scoreColor = riskClass.color;
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.circle(41.5, yPos + 20, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${displayScore}%`, 41.5, yPos + 23, { align: 'center' });
  
  // Risk label
  doc.setFontSize(9);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(riskClass.label, 41.5, yPos + 38, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 2: Exposição ao Risco
  // ═══════════════════════════════════════════════════════════════
  const severityCounts = countBySeverity(report);
  
  // Box background
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(74, yPos - 5, 55, 45, 3, 3, 'F');
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('EXPOSIÇÃO AO RISCO', 101.5, yPos + 2, { align: 'center' });
  
  // Risk counts
  const riskItems = [
    { label: 'Críticos', count: severityCounts.critical, color: [220, 38, 38] as [number, number, number] },
    { label: 'Altos', count: severityCounts.high, color: [234, 88, 12] as [number, number, number] },
    { label: 'Médios', count: severityCounts.medium, color: [202, 138, 4] as [number, number, number] },
  ];
  
  let riskY = yPos + 14;
  for (const item of riskItems) {
    // Icon circle
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(82, riskY, 3, 'F');
    
    // Count
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(String(item.count), 89, riskY + 1);
    
    // Label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, 97, riskY + 1);
    
    riskY += 10;
  }

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 3: Cobertura de Segurança (UTM)
  // ═══════════════════════════════════════════════════════════════
  const utmCoverage = calculateUTMCoverage(report);
  
  // Box background
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(134, yPos - 5, 62, 45, 3, 3, 'F');
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('COBERTURA UTM', 165, yPos + 2, { align: 'center' });
  
  // UTM stats
  let utmY = yPos + 14;
  
  // Full coverage
  doc.setFillColor(22, 163, 74);
  doc.circle(142, utmY, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 163, 74);
  doc.text(`${utmCoverage.full}/${utmCoverage.total}`, 150, utmY + 1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('UTM Completo', 168, utmY + 1);
  
  utmY += 10;
  
  // Partial coverage
  doc.setFillColor(202, 138, 4);
  doc.circle(142, utmY, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(202, 138, 4);
  doc.text(`${utmCoverage.partial}/${utmCoverage.total}`, 150, utmY + 1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('UTM Parcial', 168, utmY + 1);
  
  utmY += 10;
  
  // No coverage
  const noCoverage = utmCoverage.total - utmCoverage.full - utmCoverage.partial;
  doc.setFillColor(220, 38, 38);
  doc.circle(142, utmY, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text(`${noCoverage}/${utmCoverage.total}`, 150, utmY + 1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Sem UTM', 168, utmY + 1);

  yPos += 50;

  // ═══════════════════════════════════════════════════════════════
  // Stats Row
  // ═══════════════════════════════════════════════════════════════
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  
  const statsText = `Total: ${report.totalChecks} verificacoes  |  ${report.passed} aprovadas  |  ${report.failed} falhas  |  ${report.warnings} alertas`;
  doc.text(statsText, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 5;
  
  // Informação sobre cálculo do score
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Score = 100 - Pontos de Falha | Pesos: Crítico (5), Alto (3), Médio (1)`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 12;

  // Categories summary
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Categoria', 14, yPos);
  yPos += 5;

  // Excluir Recomendações do resumo por categoria (não afeta score)
  const scoringCategories = report.categories.filter(cat => cat.name !== 'Recomendações');
  
  const categoryData = scoringCategories.map(cat => [
    cat.name,
    `${cat.passRate}%`,
    `${cat.checks.filter(c => c.status === 'pass').length}/${cat.checks.length}`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Categoria', 'Taxa de Aprovação', 'Aprovados/Total']],
    body: categoryData,
    theme: 'striped',
    headStyles: { fillColor: [0, 150, 150], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ═══════════════════════════════════════════════════════════════
  // CVE Section (if available)
  // ═══════════════════════════════════════════════════════════════
  if (report.cves && report.cves.length > 0) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    const criticalCVEs = report.cves.filter(c => c.severity === 'CRITICAL').length;
    const highCVEs = report.cves.filter(c => c.severity === 'HIGH').length;
    const mediumCVEs = report.cves.filter(c => c.severity === 'MEDIUM').length;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(128, 0, 128); // Purple
    doc.text(`CVEs Conhecidos - FortiOS ${report.firmwareVersion || ''}`, 14, yPos);
    yPos += 6;
    
    // CVE Summary
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Total: ${report.cves.length} CVEs | ${criticalCVEs} Críticos | ${highCVEs} Altos | ${mediumCVEs} Médios`, 14, yPos);
    yPos += 4;
    
    // Disclaimer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Fonte: NIST NVD. Verifique advisories oficiais da Fortinet para informações precisas.', 14, yPos);
    yPos += 5;

    const cveData = report.cves.slice(0, 15).map(cve => [
      cve.id,
      cve.severity,
      cve.score.toFixed(1),
      new Date(cve.publishedDate).toLocaleDateString('pt-BR'),
      (cve.description || '-').substring(0, 60) + ((cve.description?.length || 0) > 60 ? '...' : '')
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['CVE ID', 'Severidade', 'Score', 'Publicado', 'Descrição']],
      body: cveData,
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 128], textColor: 255 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 15 },
        3: { cellWidth: 22 },
        4: { cellWidth: 89 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const cve = report.cves![data.row.index];
          if (cve) {
            const severity = cve.severity.toUpperCase();
            if (severity === 'CRITICAL') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (severity === 'HIGH') {
              data.cell.styles.textColor = [234, 88, 12];
              data.cell.styles.fontStyle = 'bold';
            } else if (severity === 'MEDIUM') {
              data.cell.styles.textColor = [202, 138, 4];
            }
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    if (report.cves.length > 15) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`... e mais ${report.cves.length - 15} CVEs. Consulte o NIST NVD para lista completa.`, 14, yPos);
      yPos += 10;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Licensing Section (if available)
  // ═══════════════════════════════════════════════════════════════
  const licensingCategory = report.categories.find(c => c.name === 'Licenciamento');
  if (licensingCategory) {
    // Check if we need a new page
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 0); // Green
    doc.text('Status de Licenciamento', 14, yPos);
    yPos += 6;
    
    // Description
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Verifica status do contrato FortiCare e licenças de segurança FortiGuard para garantir proteção ativa.', 14, yPos);
    yPos += 5;

    const licenseData = licensingCategory.checks.map(check => {
      // Extrair evidências de forma resumida para caber na tabela
      let detailsStr = '';
      if (check.evidence && check.evidence.length > 0) {
        // Pegar apenas status e dias restantes/data de expiração
        const statusEvidence = check.evidence.find(e => e.label === 'Status');
        const daysEvidence = check.evidence.find(e => e.label === 'Dias Restantes');
        const expiryEvidence = check.evidence.find(e => e.label === 'Data de Expiração');
        
        if (statusEvidence) {
          detailsStr = statusEvidence.value.replace(/[✅❌⚠️]/g, '').trim();
        }
        if (expiryEvidence) {
          detailsStr += detailsStr ? ` | Expira: ${expiryEvidence.value}` : `Expira: ${expiryEvidence.value}`;
        }
        if (daysEvidence && daysEvidence.value !== 'Expirado') {
          detailsStr += ` (${daysEvidence.value} dias)`;
        }
      }
      if (!detailsStr) {
        detailsStr = check.details || '-';
      }
      
      return [
        getStatusText(check.status),
        check.name,
        detailsStr.substring(0, 60) + (detailsStr.length > 60 ? '...' : '')
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Licença', 'Detalhes']],
      body: licenseData,
      theme: 'striped',
      headStyles: { fillColor: [0, 128, 0], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' },
      },
      tableWidth: 'auto',
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const check = licensingCategory.checks[data.row.index];
          if (check) {
            const color = getStatusColor(check.status);
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  yPos += 5;

  // Critical and High issues
  const criticalIssues = report.categories.flatMap(cat => 
    cat.checks.filter(c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high'))
  );

  if (criticalIssues.length > 0) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Problemas Críticos e de Alta Prioridade', 14, yPos);
    yPos += 5;

    const issuesData = criticalIssues.map(issue => [
      issue.name,
      getSeverityText(issue.severity),
      issue.details || '-',
      issue.recommendation || '-'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Verificação', 'Severidade', 'Detalhes', 'Recomendação']],
      body: issuesData,
      theme: 'striped',
      headStyles: { fillColor: [180, 50, 50], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 22 },
        2: { cellWidth: 55 },
        3: { cellWidth: 55 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const severity = criticalIssues[data.row.index]?.severity;
          if (severity) {
            const color = getSeverityColor(severity);
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Detailed checks per category
  for (const category of report.categories) {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 100, 100);
    // Para Recomendações, não mostrar percentual de aprovação
    if (category.name === 'Recomendações') {
      doc.text(category.name, 14, yPos);
    } else {
      doc.text(`${category.name} (${category.passRate}% aprovação)`, 14, yPos);
    }
    yPos += 5;
    
    // Adicionar descritivo da categoria
    const description = categoryDescriptions[category.name];
    if (description) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(description, 14, yPos);
      yPos += 5;
    }

    // Tratamento especial para categoria Recomendações - mostrar textos das recomendações
    if (category.name === 'Recomendações') {
      const recCheck = category.checks[0]; // Há apenas um check nesta categoria
      if (recCheck) {
        // Extrair as recomendações do campo recommendation ou evidence
        const recommendationTexts: string[] = [];
        
        // As recomendações são separadas por " | " no campo recommendation
        if (recCheck.recommendation && recCheck.recommendation !== 'Nenhuma recomendação adicional') {
          const recItems = recCheck.recommendation.split(' | ');
          recommendationTexts.push(...recItems);
        }
        
        // Montar dados da tabela com status, cada recomendação e detalhes do evidence
        const recTableData: string[][] = [];
        
        if (recommendationTexts.length > 0) {
          // Extrair detalhes do evidence para cada recomendação
          const evidenceMap: Record<string, string> = {};
          if (recCheck.evidence) {
            for (const ev of recCheck.evidence) {
              evidenceMap[ev.label] = ev.value;
            }
          }
          
          for (let i = 0; i < recommendationTexts.length; i++) {
            const recText = recommendationTexts[i];
            let detail = '-';
            
            // Mapear recomendação para seu evidence correspondente
            if (recText.includes('role das interfaces') && evidenceMap['Interfaces com role undefined']) {
              detail = evidenceMap['Interfaces com role undefined'];
            } else if (recText.includes('interfaces sem regras') && evidenceMap['Interfaces sem policies']) {
              detail = evidenceMap['Interfaces sem policies'];
            } else if (recText.includes('IPS/IDS') && evidenceMap['Policies inbound WAN sem IPS']) {
              detail = evidenceMap['Policies inbound WAN sem IPS'];
            }
            
            recTableData.push([
              String(i + 1),
              recText,
              detail // Não truncar - deixar expandir dinamicamente
            ]);
          }
        } else {
          recTableData.push(['✓', 'Nenhuma recomendação pendente', 'Configuração em conformidade']);
        }
        
        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Recomendação', 'Itens Afetados']],
          body: recTableData,
          theme: 'striped',
          headStyles: { fillColor: [180, 130, 0], textColor: 255 },
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 70 },
            2: { cellWidth: 'auto', minCellWidth: 60 }, // Expansão dinâmica para itens afetados
          },
          margin: { left: 14, right: 14 },
          tableWidth: 'auto',
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              if (recommendationTexts.length > 0) {
                data.cell.styles.textColor = [180, 130, 0];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [34, 197, 94];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
      continue; // Pular o processamento padrão para esta categoria
    }

    // Processamento padrão para outras categorias
    const checksData = category.checks.map(check => {
      // Para a categoria Atualizacoes, formatar melhor os detalhes do firmware
      let detailsText = check.details || '-';
      
      // Incluir resumo das evidências quando disponíveis
      if (check.evidence && check.evidence.length > 0) {
        const evidenceSummary = check.evidence
          .slice(0, 3) // Máximo 3 itens
          .map(e => `${e.label}: ${e.value}`)
          .join(' | ');
        
        if (evidenceSummary.length > 0 && evidenceSummary.length < 200) {
          detailsText = evidenceSummary;
        }
      }
      
      // Função robusta para corrigir mojibake e normalizar texto para PDF
      // Mojibake ocorre quando UTF-8 é interpretado como Latin-1
      const sanitizeForPDF = (str: string): string => {
        if (!str) return '-';
        
        let result = str;
        
        // Corrigir mojibake comum (UTF-8 interpretado como Latin-1)
        const mojibakeMap: Record<string, string> = {
          // Bullet e símbolos
          'â€¢': '-',
          '•': '-',
          '–': '-',
          '—': '-',
          '…': '...',
          // Acentuação portuguesa
          'Ã£': 'a',
          'Ã¡': 'a',
          'Ã¢': 'a',
          'Ã ': 'a',
          'Ã©': 'e',
          'Ãª': 'e',
          'Ã­': 'i',
          'Ã³': 'o',
          'Ã´': 'o',
          'Ãµ': 'o',
          'Ãº': 'u',
          'Ã§': 'c',
          'Ã±': 'n',
          'ÃƒO': 'AO',
          'Ãƒ': 'A',
          'Ã‰': 'E',
          'Ã"': 'O',
          'Ãš': 'U',
          'Ã‡': 'C',
          // Caracteres especiais
          'â€œ': '"',
          'â€™': "'",
          'â€˜': "'",
          'â€"': '-',
          'Â®': '(R)',
          'â„¢': '(TM)',
          'Â©': '(C)',
          'Â°': 'o',
          'Â±': '+/-',
          'Â²': '2',
          'Â³': '3',
          'Âµ': 'u',
          'Â¶': '',
          'Â·': '-',
          'Â¹': '1',
          'Â»': '>>',
          'Â«': '<<',
          'Â¿': '?',
          'Â¡': '!',
          'Â½': '1/2',
          'Â¼': '1/4',
          'Â¾': '3/4',
        };
        
        // Aplicar correções de mojibake
        for (const [bad, good] of Object.entries(mojibakeMap)) {
          result = result.split(bad).join(good);
        }
        
        // Substituir caracteres unicode por equivalentes ASCII
        const unicodeToAscii: Record<string, string> = {
          'ã': 'a', 'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a',
          'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
          'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
          'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
          'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
          'ç': 'c', 'ñ': 'n',
          'Ã': 'A', 'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A',
          'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
          'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
          'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
          'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
          'Ç': 'C', 'Ñ': 'N',
          '\u2705': '[OK]', '\u274C': '[X]', '\u26A0\uFE0F': '[!]', '\u26A0': '[!]',
          '\u2022': '-', '\u00B7': '-', '\u25CF': '-', '\u25CB': '-',
          '\u2192': '->', '\u2190': '<-', '\u2191': '^', '\u2193': 'v',
          '\u2605': '*', '\u2606': '*',
          '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
          '\u2013': '-', '\u2014': '-',
          '\u2026': '...',
        };
        
        for (const [unicode, ascii] of Object.entries(unicodeToAscii)) {
          result = result.split(unicode).join(ascii);
        }
        
        // Remover emojis e caracteres não imprimíveis
        result = result
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
          .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
          .replace(/[\uFE00-\uFE0F]/g, '')         // Variation selectors
          .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Zero-width chars
          .replace(/[^\x20-\x7E\n\r\t]/g, '')     // Manter apenas ASCII imprimível
          .replace(/\s+/g, ' ')                    // Normalizar espaços
          .trim();
        
        return result || '-';
      };
      
      // Para Atualizações, usar o details original que já vem formatado da API
      // O details já contém: "Versao DESATUALIZADA: FortiOS X.X.X - Recomendada: Y.Y.Y"
      if (category.name === 'Atualizações') {
        // Usar details original, apenas sanitizar
        detailsText = sanitizeForPDF(detailsText);
      } else {
        // Limpar e sanitizar qualquer texto de detalhes
        detailsText = sanitizeForPDF(detailsText);
      }
      
      return [
        getStatusText(check.status),
        check.name,
        getSeverityText(check.severity),
        detailsText.substring(0, 80) + (detailsText.length > 80 ? '...' : '')
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Verificação', 'Severidade', 'Detalhes']],
      body: checksData,
      theme: 'striped',
      headStyles: { fillColor: [0, 130, 130], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 45 },
        2: { cellWidth: 22 },
        3: { cellWidth: 85 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const check = category.checks[data.row.index];
          if (check) {
            if (data.column.index === 0) {
              const color = getStatusColor(check.status);
              data.cell.styles.textColor = color;
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 2) {
              const color = getSeverityColor(check.severity);
              data.cell.styles.textColor = color;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount} | ${vendorLabel} Compliance Report`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save - use device name in filename
  const safeDeviceName = deviceName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const fileName = `compliance-${safeDeviceName}-${generatedAtDate.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL DOMAIN COMPLIANCE REPORT PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

interface ExternalDomainInfo {
  name: string;
  domain: string;
  clientName?: string;
}

interface DnsSummary {
  ns?: string[];
  soaMname?: string | null;
  soaContact?: string | null;
  dnssecHasDnskey?: boolean;
  dnssecHasDs?: boolean;
  dnssecValidated?: boolean;
  dnssecNotes?: string[];
}

interface EmailAuthStatus {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
}

// Cores para categorias do relatório de domínio externo
const DOMAIN_CATEGORY_COLORS: Record<string, [number, number, number]> = {
  'Segurança DNS': [6, 182, 212],        // cyan-500
  'Infraestrutura de Email': [139, 92, 246], // violet-500
  'Autenticação de Email - SPF': [16, 185, 129], // emerald-500
  'Autenticação de Email - DKIM': [236, 72, 153], // pink-500
  'Autenticação de Email - DMARC': [245, 158, 11], // amber-500
};

const getDomainCategoryColor = (categoryName: string): [number, number, number] => {
  return DOMAIN_CATEGORY_COLORS[categoryName] || [0, 150, 150];
};

// Humanize evidence for PDF - translate technical data to readable format
function humanizeEvidence(check: ComplianceCheck): string[] {
  const result: string[] = [];
  const ruleId = check.id?.toUpperCase() || '';
  
  // Extract data from evidence or rawData
  const rawData = check.rawData || {};
  
  // Nameservers - one per line
  if (rawData.records && Array.isArray(rawData.records)) {
    const hosts = rawData.records.map((r: any) => r.host || r.value || String(r)).filter(Boolean);
    if (hosts.length > 0) {
      if (ruleId.includes('NS') || ruleId.includes('NAMESERVER')) {
        result.push(`Nameservers encontrados: ${hosts.length}`);
        hosts.forEach((h: string) => result.push(`  - ${h}`));
      } else if (ruleId.includes('MX')) {
        result.push(`Servidores MX: ${hosts.length}`);
        hosts.slice(0, 5).forEach((h: string) => result.push(`  - ${h}`));
      }
    }
  }
  
  // DNSSEC status
  if (rawData.has_dnskey !== undefined) {
    result.push(`DNSKEY presente: ${rawData.has_dnskey ? 'Sim' : 'Nao'}`);
  }
  if (rawData.has_ds !== undefined) {
    result.push(`Registro DS: ${rawData.has_ds ? 'Sim' : 'Nao'}`);
  }
  
  // SOA values
  if (rawData.refresh) {
    result.push(`SOA Refresh: ${rawData.refresh} segundos`);
  }
  if (rawData.serial) {
    result.push(`SOA Serial: ${rawData.serial}`);
  }
  if (rawData.mname) {
    result.push(`SOA Primary: ${rawData.mname}`);
  }
  
  // SPF
  if (rawData.spf_record) {
    const spf = String(rawData.spf_record);
    result.push(`Registro SPF: ${spf.length > 80 ? spf.substring(0, 77) + '...' : spf}`);
  }
  if (rawData.mechanism_count !== undefined) {
    result.push(`Mecanismos SPF: ${rawData.mechanism_count}`);
  }
  
  // DKIM
  if (rawData.selector_count !== undefined) {
    result.push(`Seletores DKIM encontrados: ${rawData.selector_count}`);
  }
  if (rawData.key_count !== undefined) {
    result.push(`Chaves DKIM validas: ${rawData.key_count}`);
  }
  if (rawData.selectors && Array.isArray(rawData.selectors)) {
    result.push(`Seletores: ${rawData.selectors.slice(0, 5).join(', ')}`);
  }
  
  // DMARC
  if (rawData.policy) {
    result.push(`Politica DMARC: ${rawData.policy}`);
  }
  if (rawData.rua) {
    result.push(`Endereco de relatorios (rua): ${rawData.rua}`);
  }
  if (rawData.pct !== undefined) {
    result.push(`Percentual aplicado: ${rawData.pct}%`);
  }
  
  // Generic count
  if (rawData.count !== undefined && result.length === 0) {
    result.push(`Quantidade: ${rawData.count}`);
  }
  
  // Fallback to evidence array
  if (result.length === 0 && check.evidence && check.evidence.length > 0) {
    for (const ev of check.evidence.slice(0, 3)) {
      // Skip raw JSON-like data
      if (ev.value && !ev.value.includes('data.') && !ev.value.startsWith('[') && !ev.value.startsWith('{')) {
        result.push(`${ev.label}: ${sanitizeTextForPDF(ev.value)}`);
      }
    }
  }
  
  return result;
}

export function exportExternalDomainReportToPDF(
  report: ComplianceReport,
  domainInfo: ExternalDomainInfo,
  dnsSummary?: DnsSummary,
  emailAuth?: EmailAuthStatus
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPos = 12;

  // Ensure generatedAt is a Date object
  const generatedAtDate = report.generatedAt instanceof Date 
    ? report.generatedAt 
    : new Date(report.generatedAt);

  // Helper: Check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 25) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // ═══════════════════════════════════════════════════════════════
  // HEADER - iScope 360 Branding
  // ═══════════════════════════════════════════════════════════════
  
  // Dark header background
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageWidth, 48, 'F');
  
  // Accent line at bottom of header
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(1);
  doc.line(0, 48, pageWidth, 48);

  // System name - iScope 360 (main title)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 184, 166); // teal-500
  doc.text('iScope 360', pageWidth / 2, 18, { align: 'center' });
  
  // Domain name - subtitle
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Analise de Compliance: ${domainInfo.domain}`, pageWidth / 2, 30, { align: 'center' });
  
  // Meta info line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  const metaParts = [];
  if (domainInfo.clientName) metaParts.push(`Cliente: ${domainInfo.clientName}`);
  metaParts.push(`Gerado em ${generatedAtDate.toLocaleString('pt-BR')}`);
  doc.text(metaParts.join('  |  '), pageWidth / 2, 42, { align: 'center' });

  yPos = 58;

  // ═══════════════════════════════════════════════════════════════
  // CARDS ROW: Score, Verificações, Email Auth
  // ═══════════════════════════════════════════════════════════════
  
  const cardWidth = (contentWidth - 10) / 3; // 3 cards with gaps
  const cardHeight = 50;
  const cardY = yPos;
  
  const riskClass = getRiskClassification(report.overallScore);
  
  // Card 1: Score Geral
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(marginLeft, cardY, cardWidth, cardHeight, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('SCORE GERAL', marginLeft + cardWidth/2, cardY + 10, { align: 'center' });
  
  // Score circle
  doc.setFillColor(riskClass.color[0], riskClass.color[1], riskClass.color[2]);
  doc.circle(marginLeft + cardWidth/2, cardY + 28, 12, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${report.overallScore}`, marginLeft + cardWidth/2, cardY + 31, { align: 'center' });
  
  // Risk label
  doc.setFontSize(8);
  doc.setTextColor(riskClass.color[0], riskClass.color[1], riskClass.color[2]);
  doc.text(riskClass.label, marginLeft + cardWidth/2, cardY + 45, { align: 'center' });
  
  // Card 2: Verificações
  const card2X = marginLeft + cardWidth + 5;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('VERIFICACOES', card2X + cardWidth/2, cardY + 10, { align: 'center' });
  
  // Stats with colored dots
  const statsY = cardY + 20;
  const statsData = [
    { label: 'Total', value: report.totalChecks, color: [56, 189, 248] as [number, number, number] },
    { label: 'Aprovadas', value: report.passed, color: [34, 197, 94] as [number, number, number] },
    { label: 'Falhas', value: report.failed, color: [248, 113, 113] as [number, number, number] },
  ];
  
  let statLineY = statsY;
  for (const stat of statsData) {
    doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.circle(card2X + 12, statLineY, 3, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(String(stat.value), card2X + 20, statLineY + 1);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(stat.label, card2X + 32, statLineY + 1);
    statLineY += 10;
  }
  
  // Card 3: Email Auth
  const card3X = marginLeft + (cardWidth + 5) * 2;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('EMAIL AUTH', card3X + cardWidth/2, cardY + 10, { align: 'center' });
  
  const emailChecks = [
    { label: 'SPF', valid: emailAuth?.spf ?? false },
    { label: 'DKIM', valid: emailAuth?.dkim ?? false },
    { label: 'DMARC', valid: emailAuth?.dmarc ?? false },
  ];
  
  let emailLineY = cardY + 20;
  for (const item of emailChecks) {
    const color: [number, number, number] = item.valid ? [34, 197, 94] : [248, 113, 113];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(card3X + 12, emailLineY, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(item.label, card3X + 20, emailLineY + 1);
    doc.setFontSize(9);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(item.valid ? 'Valido' : 'Ausente', card3X + cardWidth - 12, emailLineY + 1, { align: 'right' });
    emailLineY += 10;
  }
  
  yPos = cardY + cardHeight + 10;

  // ═══════════════════════════════════════════════════════════════
  // DNS INFRASTRUCTURE CARD - Dynamic height based on nameservers
  // ═══════════════════════════════════════════════════════════════
  
  if (dnsSummary) {
    const nsServers = dnsSummary.ns || [];
    // Calculate dynamic card height: base + extra lines for nameservers
    const nsDisplayCount = Math.min(nsServers.length, 5);
    const cardBaseHeight = 32;
    const nsExtraHeight = nsDisplayCount > 1 ? (nsDisplayCount - 1) * 6 : 0;
    const dnsCardHeight = cardBaseHeight + nsExtraHeight;
    
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(marginLeft, yPos, contentWidth, dnsCardHeight, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('INFRAESTRUTURA DNS', marginLeft + 6, yPos + 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    // Left column - SOA Primary
    doc.text('SOA Primary:', marginLeft + 6, yPos + 18);
    doc.setFont('helvetica', 'bold');
    doc.text(dnsSummary.soaMname || 'N/A', marginLeft + 35, yPos + 18);
    
    // Nameservers - ONE PER LINE to avoid horizontal overflow
    doc.setFont('helvetica', 'normal');
    doc.text('Nameservers:', marginLeft + 6, yPos + 26);
    if (nsServers.length > 0) {
      doc.setFont('helvetica', 'bold');
      let nsLineY = yPos + 26;
      for (let i = 0; i < nsDisplayCount; i++) {
        doc.text(nsServers[i], marginLeft + 35, nsLineY);
        nsLineY += 6;
      }
      if (nsServers.length > 5) {
        doc.setFont('helvetica', 'normal');
        doc.text(`(+${nsServers.length - 5} mais)`, marginLeft + 35, nsLineY);
      }
    }
    
    // Right column
    const rightColX = marginLeft + contentWidth/2 + 10;
    doc.setFont('helvetica', 'normal');
    doc.text('DNSSEC:', rightColX, yPos + 18);
    const dnssecActive = dnsSummary.dnssecHasDnskey && dnsSummary.dnssecHasDs;
    const dnssecColor: [number, number, number] = dnssecActive ? [34, 197, 94] : [239, 68, 68];
    doc.setFillColor(dnssecColor[0], dnssecColor[1], dnssecColor[2]);
    doc.circle(rightColX + 20, yPos + 16, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(dnssecColor[0], dnssecColor[1], dnssecColor[2]);
    doc.text(dnssecActive ? 'Ativo' : 'Inativo', rightColX + 26, yPos + 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('SOA Contact:', rightColX, yPos + 26);
    doc.setFont('helvetica', 'bold');
    const contact = dnsSummary.soaContact || 'N/A';
    const contactTrunc = contact.length > 35 ? contact.substring(0, 32) + '...' : contact;
    doc.text(contactTrunc, rightColX + 28, yPos + 26);
    
    yPos += dnsCardHeight + 16; // Increased vertical spacing before category summary
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY SUMMARY TABLE - Full Width
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Resumo por Categoria', marginLeft, yPos);
  yPos += 6;

  const categoryData = report.categories.map(cat => {
    const failCount = cat.checks.filter(c => c.status === 'fail').length;
    return [
      cat.name,
      `${cat.passRate}%`,
      `${cat.checks.filter(c => c.status === 'pass').length}/${cat.checks.length}`,
      failCount > 0 ? `${failCount} ${failCount === 1 ? 'falha' : 'falhas'}` : '0 falhas'
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Categoria', 'Taxa', 'Aprovados', 'Falhas']],
    body: categoryData,
    theme: 'striped',
    headStyles: { 
      fillColor: [20, 184, 166], 
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 32, halign: 'center' },
    },
    margin: { left: marginLeft, right: marginRight },
    tableWidth: contentWidth,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const catName = report.categories[data.row.index]?.name;
        if (catName) {
          const color = getDomainCategoryColor(catName);
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ═══════════════════════════════════════════════════════════════
  // CRITICAL/HIGH ISSUES FOUND
  // ═══════════════════════════════════════════════════════════════
  
  const criticalHighIssues = report.categories
    .flatMap(c => c.checks)
    .filter(c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high'));
  
  if (criticalHighIssues.length > 0) {
    checkPageBreak(30);
    
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(252, 165, 165); // red-300
    doc.roundedRect(marginLeft, yPos, contentWidth, 10 + criticalHighIssues.length * 8, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(`Problemas Encontrados (${criticalHighIssues.length})`, marginLeft + 6, yPos + 7);
    
    let issueY = yPos + 14;
    for (const issue of criticalHighIssues.slice(0, 8)) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(127, 29, 29);
      const issueName = issue.name.length > 70 ? issue.name.substring(0, 67) + '...' : issue.name;
      doc.text(`• ${issueName}`, marginLeft + 8, issueY);
      issueY += 7;
    }
    if (criticalHighIssues.length > 8) {
      doc.text(`  ... e mais ${criticalHighIssues.length - 8} problemas`, marginLeft + 8, issueY);
    }
    
    yPos += 18 + Math.min(criticalHighIssues.length, 8) * 8;
  }

  // ═══════════════════════════════════════════════════════════════
  // DETAILED CHECKS BY CATEGORY - Vertical Block Format
  // ═══════════════════════════════════════════════════════════════
  
  for (const category of report.categories) {
    checkPageBreak(35);

    const catColor = getDomainCategoryColor(category.name);
    
    // Category header bar
    doc.setFillColor(catColor[0], catColor[1], catColor[2]);
    doc.roundedRect(marginLeft, yPos, contentWidth, 10, 2, 2, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(category.name, marginLeft + 6, yPos + 7);
    
    // Pass rate on the right
    doc.setFontSize(9);
    doc.text(`${category.passRate}%`, pageWidth - marginRight - 8, yPos + 7, { align: 'right' });
    
    yPos += 16;

    // Each check as a block with more vertical spacing
    for (const check of category.checks) {
      checkPageBreak(35);
      
      const statusColor = getStatusColor(check.status);
      
      // Status indicator circle
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.circle(marginLeft + 5, yPos + 2, 3, 'F');
      
      // Check name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(check.name, marginLeft + 12, yPos + 4);
      
      // Status text on the right (no severity - as requested)
      doc.setFontSize(9);
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(getStatusText(check.status), pageWidth - marginRight - 4, yPos + 4, { align: 'right' });
      
      yPos += 10;
      
      // Description/Details - full width, can wrap
      const detailText = sanitizeTextForPDF(check.details || check.description || '');
      if (detailText && detailText !== '-') {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        
        // Split text to wrap within content width
        const splitText = doc.splitTextToSize(detailText, contentWidth - 16);
        for (const line of splitText.slice(0, 4)) { // Max 4 lines
          checkPageBreak(6);
          doc.text(line, marginLeft + 12, yPos);
          yPos += 5;
        }
        if (splitText.length > 4) {
          doc.text('...', marginLeft + 12, yPos);
          yPos += 5;
        }
      }
      
      // Recommendation if it's a failure
      if (check.status === 'fail' && check.recommendation) {
        checkPageBreak(12);
        yPos += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(185, 28, 28);
        doc.text('Recomendacao:', marginLeft + 12, yPos);
        yPos += 5;
        
        const recText = sanitizeTextForPDF(check.recommendation);
        const splitRec = doc.splitTextToSize(recText, contentWidth - 20);
        for (const line of splitRec.slice(0, 3)) { // Max 3 lines
          checkPageBreak(6);
          doc.text(`  ${line}`, marginLeft + 12, yPos);
          yPos += 5;
        }
      }
      
      // Removed evidence section as requested
      
      yPos += 10; // More space between checks
    }
    
    yPos += 10; // Space between categories
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER ON ALL PAGES
  // ═══════════════════════════════════════════════════════════════
  
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 15, pageWidth - marginRight, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Pagina ${i} de ${pageCount}`, marginLeft, pageHeight - 10);
    doc.text('iScope 360', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(domainInfo.domain, pageWidth - marginRight, pageHeight - 10, { align: 'right' });
  }

  // Save PDF
  const safeDomainName = domainInfo.domain.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
  const fileName = `iscope360-${safeDomainName}-${generatedAtDate.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
