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

export function exportExternalDomainReportToPDF(
  report: ComplianceReport,
  domainInfo: ExternalDomainInfo,
  dnsSummary?: DnsSummary,
  emailAuth?: EmailAuthStatus
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 15;

  // Ensure generatedAt is a Date object
  const generatedAtDate = report.generatedAt instanceof Date 
    ? report.generatedAt 
    : new Date(report.generatedAt);

  // ═══════════════════════════════════════════════════════════════
  // HEADER - Command Center Style
  // ═══════════════════════════════════════════════════════════════
  
  // Title bar background
  doc.setFillColor(17, 24, 39); // Dark background
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  // Accent line
  doc.setDrawColor(20, 184, 166); // teal-500
  doc.setLineWidth(0.8);
  doc.line(14, 48, pageWidth - 14, 48);

  // Report title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text('ANALISE DE COMPLIANCE', pageWidth / 2, 14, { align: 'center' });
  
  // Domain name - prominent
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(domainInfo.domain.toUpperCase(), pageWidth / 2, 28, { align: 'center' });
  
  // Subtitle with client and date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  const subtitleParts = [];
  if (domainInfo.clientName) subtitleParts.push(domainInfo.clientName);
  subtitleParts.push(`Gerado em ${generatedAtDate.toLocaleString('pt-BR')}`);
  doc.text(subtitleParts.join(' | '), pageWidth / 2, 40, { align: 'center' });

  yPos = 62;

  // ═══════════════════════════════════════════════════════════════
  // SCORE SECTION - Three Boxes
  // ═══════════════════════════════════════════════════════════════
  
  const boxWidth = 58;
  const boxGap = 6;
  const startX = (pageWidth - (boxWidth * 3 + boxGap * 2)) / 2;
  
  // Box 1: Score Principal
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(startX, yPos, boxWidth, 48, 3, 3, 'F');
  
  const riskClass = getRiskClassification(report.overallScore);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175);
  doc.text('SCORE GERAL', startX + boxWidth / 2, yPos + 10, { align: 'center' });
  
  // Score circle
  doc.setFillColor(riskClass.color[0], riskClass.color[1], riskClass.color[2]);
  doc.circle(startX + boxWidth / 2, yPos + 27, 11, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${report.overallScore}`, startX + boxWidth / 2, yPos + 30, { align: 'center' });
  
  // Risk label
  doc.setFontSize(8);
  doc.setTextColor(riskClass.color[0], riskClass.color[1], riskClass.color[2]);
  doc.text(riskClass.label, startX + boxWidth / 2, yPos + 44, { align: 'center' });

  // Box 2: Estatísticas
  const box2X = startX + boxWidth + boxGap;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(box2X, yPos, boxWidth, 48, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175);
  doc.text('VERIFICACOES', box2X + boxWidth / 2, yPos + 10, { align: 'center' });
  
  // Stats rows
  const statsItems = [
    { label: 'Total', value: report.totalChecks, color: [56, 189, 248] as [number, number, number] },
    { label: 'Aprovadas', value: report.passed, color: [34, 197, 94] as [number, number, number] },
    { label: 'Falhas', value: report.failed, color: [239, 68, 68] as [number, number, number] },
  ];
  
  let statY = yPos + 20;
  for (const item of statsItems) {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(box2X + 10, statY, 2.5, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(String(item.value), box2X + 18, statY + 1);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(item.label, box2X + 28, statY + 1);
    statY += 9;
  }

  // Box 3: Email Auth Status
  const box3X = startX + (boxWidth + boxGap) * 2;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(box3X, yPos, boxWidth, 48, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175);
  doc.text('EMAIL AUTH', box3X + boxWidth / 2, yPos + 10, { align: 'center' });
  
  const emailItems = [
    { label: 'SPF', valid: emailAuth?.spf ?? false },
    { label: 'DKIM', valid: emailAuth?.dkim ?? false },
    { label: 'DMARC', valid: emailAuth?.dmarc ?? false },
  ];
  
  let emailY = yPos + 20;
  for (const item of emailItems) {
    const color: [number, number, number] = item.valid ? [34, 197, 94] : [239, 68, 68];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(box3X + 10, emailY, 2.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(item.label, box3X + 18, emailY + 1);
    doc.setFontSize(8);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(item.valid ? 'Valido' : 'Ausente', box3X + 38, emailY + 1);
    emailY += 9;
  }

  yPos += 58;

  // ═══════════════════════════════════════════════════════════════
  // DNS SUMMARY SECTION
  // ═══════════════════════════════════════════════════════════════
  
  if (dnsSummary) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(14, yPos, pageWidth - 28, 36, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('INFRAESTRUTURA DNS', 20, yPos + 8);
    
    // SOA Primary
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('SOA Primary:', 20, yPos + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(dnsSummary.soaMname || 'N/A', 50, yPos + 17);
    
    // Nameservers
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Nameservers:', 20, yPos + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const nsText = dnsSummary.ns?.slice(0, 3).join(', ') || 'N/A';
    doc.text(nsText, 50, yPos + 25);
    
    // DNSSEC status
    const dnssecActive = dnsSummary.dnssecHasDnskey && dnsSummary.dnssecHasDs;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('DNSSEC:', 130, yPos + 17);
    
    const dnssecColor: [number, number, number] = dnssecActive ? [34, 197, 94] : [239, 68, 68];
    doc.setFillColor(dnssecColor[0], dnssecColor[1], dnssecColor[2]);
    doc.circle(152, yPos + 15.5, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(dnssecColor[0], dnssecColor[1], dnssecColor[2]);
    doc.text(dnssecActive ? 'Ativo' : 'Inativo', 157, yPos + 17);
    
    // SOA Contact
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Contato SOA:', 130, yPos + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(dnsSummary.soaContact || 'N/A', 160, yPos + 25);

    yPos += 44;
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY SUMMARY TABLE
  // ═══════════════════════════════════════════════════════════════
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Resumo por Categoria', 14, yPos);
  yPos += 5;

  const categoryData = report.categories.map(cat => [
    cat.name,
    `${cat.passRate}%`,
    `${cat.checks.filter(c => c.status === 'pass').length}/${cat.checks.length}`,
    `${cat.checks.filter(c => c.status === 'fail').length} falhas`
  ]);

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
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
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
  // CRITICAL AND HIGH PRIORITY ISSUES
  // ═══════════════════════════════════════════════════════════════
  
  const criticalIssues = report.categories.flatMap(cat => 
    cat.checks.filter(c => c.status === 'fail' && (c.severity === 'critical' || c.severity === 'high'))
  );

  if (criticalIssues.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    // Red accent header
    doc.setFillColor(254, 226, 226); // red-100
    doc.roundedRect(14, yPos, pageWidth - 28, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28); // red-700
    doc.text(`${criticalIssues.length} PROBLEMAS CRITICOS/ALTOS ENCONTRADOS`, 20, yPos + 7);
    yPos += 14;

    const issuesData = criticalIssues.map(issue => [
      issue.name,
      getSeverityText(issue.severity),
      (issue.details || issue.description || '-').substring(0, 50) + ((issue.details?.length || 0) > 50 ? '...' : ''),
      (issue.recommendation || '-').substring(0, 45) + ((issue.recommendation?.length || 0) > 45 ? '...' : '')
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Verificacao', 'Severidade', 'Detalhes', 'Recomendacao']],
      body: issuesData,
      theme: 'striped',
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 22 },
        2: { cellWidth: 50 },
        3: { cellWidth: 58 },
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

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // ═══════════════════════════════════════════════════════════════
  // DETAILED CHECKS PER CATEGORY
  // ═══════════════════════════════════════════════════════════════
  
  for (const category of report.categories) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    const catColor = getDomainCategoryColor(category.name);
    
    // Category header with colored accent
    doc.setFillColor(catColor[0], catColor[1], catColor[2]);
    doc.roundedRect(14, yPos, 3, 10, 1, 1, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(catColor[0], catColor[1], catColor[2]);
    doc.text(`${category.name}`, 20, yPos + 7);
    
    // Pass rate badge
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${category.passRate}% aprovacao`, pageWidth - 45, yPos + 7);
    
    yPos += 12;

    const checksData = category.checks.map(check => {
      // Extract evidence summary
      let evidenceText = '';
      if (check.evidence && check.evidence.length > 0) {
        evidenceText = check.evidence
          .slice(0, 2)
          .map(e => `${e.label}: ${e.value}`)
          .join(' | ')
          .substring(0, 60);
        if (evidenceText.length >= 60) evidenceText += '...';
      }
      
      return [
        getStatusText(check.status),
        check.name,
        getSeverityText(check.severity),
        (check.details || check.description || evidenceText || '-').substring(0, 55) + 
          ((check.details?.length || check.description?.length || 0) > 55 ? '...' : '')
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Verificacao', 'Severidade', 'Detalhes/Evidencias']],
      body: checksData,
      theme: 'striped',
      headStyles: { 
        fillColor: [catColor[0], catColor[1], catColor[2]], 
        textColor: 255,
        fontSize: 8 
      },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: 22 },
        3: { cellWidth: 80 },
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
            }
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
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
    doc.line(14, doc.internal.pageSize.height - 15, pageWidth - 14, doc.internal.pageSize.height - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Pagina ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
    doc.text(
      `Relatorio de Compliance - ${domainInfo.domain}`,
      pageWidth - 14,
      doc.internal.pageSize.height - 10,
      { align: 'right' }
    );
  }

  // Save PDF
  const safeDomainName = domainInfo.domain.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
  const fileName = `compliance-dominio-${safeDomainName}-${generatedAtDate.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
