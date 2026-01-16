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

// Descritivos de cada categoria de análise
const categoryDescriptions: Record<string, string> = {
  'Segurança de Interfaces': 'Verifica configurações de acesso às interfaces de gerenciamento, incluindo protocolos inseguros como HTTP e Telnet.',
  'Regras de Entrada': 'Analisa políticas de firewall que permitem tráfego de entrada da internet, identificando exposições de serviços críticos.',
  'Configuração de Rede': 'Avalia configurações gerais de rede, incluindo regras permissivas e segmentação.',
  'Políticas de Segurança': 'Examina configurações de autenticação administrativa, incluindo 2FA, políticas de senha e timeout.',
  'Atualização de Firmware': 'Verifica a versão do FortiOS instalada e identifica atualizações disponíveis.',
  'Atualizações': 'Verifica a versão do FortiOS instalada e identifica atualizações disponíveis.',
  'Perfis de Segurança UTM': 'Analisa a aplicação de perfis de segurança (IPS, AV, WebFilter, AppControl) nas políticas.',
  'Configuração VPN': 'Avalia configurações de VPN IPSec e SSL VPN, incluindo algoritmos e certificados.',
  'Logging e Monitoramento': 'Verifica configurações de log e integração com FortiAnalyzer/FortiCloud.',
  'Licenciamento': 'Verifica status do FortiCare e licenças FortiGuard (AV, IPS, WebFilter, AppControl).',
  'Recomendações': 'Sumário de recomendações com base na análise de conformidade, incluindo interfaces, políticas e perfis de segurança.',
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

export function exportReportToPDF(report: ComplianceReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // Ensure generatedAt is a Date object
  const generatedAtDate = report.generatedAt instanceof Date 
    ? report.generatedAt 
    : new Date(report.generatedAt);

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 180, 180);
  doc.text('FortiGate Compliance Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${generatedAtDate.toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });

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
      // Para a categoria Atualizações, formatar melhor os detalhes do firmware
      let detailsText = check.details || '-';
      
      // Função auxiliar para remover emojis e caracteres unicode problemáticos no PDF
      const cleanUnicode = (str: string): string => {
        return str
          .replace(/[\u2705\u274C\u26A0\uFE0F]/g, '') // Remove ✅❌⚠️
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove outros emojis
          .replace(/[^\x00-\x7F\xC0-\xFF\u00A0-\u00FF]/g, '') // Remove caracteres não-Latin1
          .replace(/\s+/g, ' ') // Normalizar espaços
          .trim();
      };
      
      // Se houver evidence, usar para construir detalhes mais legíveis
      if (category.name === 'Atualizações' && check.evidence && check.evidence.length > 0) {
        const versionEv = check.evidence.find(e => e.label === 'Versão Atual' || e.label === 'Versão');
        const statusEv = check.evidence.find(e => e.label === 'Status');
        const buildEv = check.evidence.find(e => e.label === 'Build');
        
        const parts: string[] = [];
        if (versionEv) parts.push(`Versao: ${cleanUnicode(versionEv.value)}`);
        if (buildEv) parts.push(`Build: ${cleanUnicode(buildEv.value)}`);
        if (statusEv && !versionEv) parts.push(cleanUnicode(statusEv.value));
        
        if (parts.length > 0) {
          detailsText = parts.join(' | ');
        }
      } else {
        // Limpar unicode de qualquer texto de detalhes
        detailsText = cleanUnicode(detailsText);
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
      `Página ${i} de ${pageCount} | FortiGate Compliance Checker`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `fortigate-compliance-${generatedAtDate.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
