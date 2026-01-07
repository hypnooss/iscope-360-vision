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
    case 'fail': return [239, 68, 68]; // red
    case 'warning': return [234, 179, 8]; // yellow
    default: return [107, 114, 128]; // gray
  }
};

export function exportReportToPDF(report: ComplianceReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 200, 200);
  doc.text('FortiGate Compliance Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${report.generatedAt.toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });

  // Score section
  yPos += 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Resumo Executivo', 14, yPos);

  yPos += 10;
  
  // Score circle approximation
  const scoreColor = report.overallScore >= 70 ? [34, 197, 94] : report.overallScore >= 40 ? [234, 179, 8] : [239, 68, 68];
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.circle(35, yPos + 15, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.overallScore}%`, 35, yPos + 18, { align: 'center' });
  
  // Stats
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  const statsStartX = 70;
  doc.text(`Total de Verificações: ${report.totalChecks}`, statsStartX, yPos + 5);
  doc.setTextColor(34, 197, 94);
  doc.text(`Aprovadas: ${report.passed}`, statsStartX, yPos + 13);
  doc.setTextColor(239, 68, 68);
  doc.text(`Falhas: ${report.failed}`, statsStartX, yPos + 21);
  doc.setTextColor(234, 179, 8);
  doc.text(`Alertas: ${report.warnings}`, statsStartX, yPos + 29);

  yPos += 45;

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
    doc.setTextColor(239, 68, 68);
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
        if (data.section === 'body' && data.column.index === 0) {
          const status = category.checks[data.row.index]?.status;
          if (status) {
            const color = getStatusColor(status);
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = 'bold';
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
