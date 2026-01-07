import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComplianceReport, ComplianceCheck } from '@/types/compliance';

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
  if (score >= 80) return { label: 'Risco Baixo', color: [22, 163, 74] };
  if (score >= 60) return { label: 'Risco Moderado', color: [202, 138, 4] };
  if (score >= 40) return { label: 'Risco Elevado', color: [234, 88, 12] };
  return { label: 'Risco Crítico', color: [220, 38, 38] };
}

// Calcular cobertura UTM
function calculateUTMCoverage(report: ComplianceReport): { full: number; partial: number; total: number } {
  const utmCategory = report.categories.find(c => c.name === 'Perfis de Segurança UTM');
  if (!utmCategory) return { full: 0, partial: 0, total: 0 };
  
  // Extrair informações dos checks UTM
  const ipsCheck = utmCategory.checks.find(c => c.id === 'utm-001');
  const webFilterCheck = utmCategory.checks.find(c => c.id === 'utm-004');
  const appControlCheck = utmCategory.checks.find(c => c.id === 'utm-007');
  const avCheck = utmCategory.checks.find(c => c.id === 'utm-009');
  
  // Extrair total de políticas do rawData
  const totalPolicies = Number(ipsCheck?.rawData?.total) || 0;
  
  // Contar políticas com cobertura completa (todos os 4 perfis)
  const ipsCount = Number(ipsCheck?.rawData?.withIPS) || 0;
  const webFilterCount = Number(webFilterCheck?.rawData?.withWebFilter) || 0;
  const appControlCount = Number(appControlCheck?.rawData?.withAppControl) || 0;
  const avCount = Number(avCheck?.rawData?.withAV) || 0;
  
  // Políticas com cobertura completa (estimativa: menor valor entre todos)
  const fullCoverage = Math.min(ipsCount, webFilterCount, appControlCount, avCount);
  
  // Políticas com pelo menos algum perfil UTM
  const partialCoverage = Math.max(ipsCount, webFilterCount, appControlCount, avCount) - fullCoverage;
  
  return { 
    full: fullCoverage, 
    partial: partialCoverage, 
    total: Number(totalPolicies) || 0 
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

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 180, 180);
  doc.text('FortiGate Compliance Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${report.generatedAt.toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════
  // BLOCO 1: Score de Compliance Geral (mesmo do dashboard)
  // ═══════════════════════════════════════════════════════════════
  yPos += 18;
  
  const allChecks = report.categories.flatMap(c => c.checks);
  const weightedScore = calculateWeightedScore(allChecks);
  
  // Usar o score do report (mesmo do dashboard)
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
  
  const statsText = `Total: ${report.totalChecks} verificações  |  ✓ ${report.passed} aprovadas  |  ✗ ${report.failed} falhas  |  ⚠ ${report.warnings} alertas`;
  doc.text(statsText, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 5;
  
  // Score ponderado como informação adicional
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Score Ponderado (risco): ${weightedScore}% | Pesos: Crítico (5), Alto (3), Médio (1)`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 12;

  // Categories summary
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo por Categoria', 14, yPos);
  yPos += 5;

  const categoryData = report.categories.map(cat => [
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
    doc.text(`${category.name} (${category.passRate}% aprovação)`, 14, yPos);
    yPos += 5;

    const checksData = category.checks.map(check => [
      getStatusText(check.status),
      check.name,
      getSeverityText(check.severity),
      (check.details || '-').substring(0, 80) + ((check.details?.length || 0) > 80 ? '...' : '')
    ]);

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
  const fileName = `fortigate-compliance-${report.generatedAt.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
