import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  baseStyles,
} from './styles/pdfStyles';
import {
  PDFHeader,
  PDFScoreGauge,
  PDFComplianceStats,
  PDFFirewallInfo,
  PDFIssuesSummary,
  PDFCategorySection,
  PDFFooter,
} from './sections';
import type { Issue, Check } from './sections';

// Page styles
const pageStyles = StyleSheet.create({
  page: {
    ...baseStyles.page,
    paddingBottom: 60, // Space for footer
  },
  content: {
    flex: 1,
  },
  heroSection: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: spacing.sectionGap,
  },
  scoreColumn: {
    width: 140,
    alignItems: 'center',
  },
  statsColumn: {
    flex: 1,
  },
  categoriesSection: {
    marginTop: spacing.sectionGap,
  },
  sectionTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.itemGap,
  },
  // Security Notice
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  noticeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIconText: {
    fontSize: 12,
    fontFamily: typography.bold,
    color: '#FFFFFF',
  },
  noticeText: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: '#1E40AF',
    lineHeight: 1.4,
  },
});

// Types
interface SystemInfo {
  vendor?: string;
  model?: string;
  serial?: string;
  hostname?: string;
  uptime?: string;
}

interface ComplianceCategory {
  name: string;
  passRate: number;
  checks: Array<{
    id: string;
    name: string;
    status: 'pass' | 'fail' | 'warning' | 'pending';
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description?: string;
    recommendation?: string;
  }>;
}

interface FirewallPDFProps {
  report: {
    overallScore: number;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    categories: ComplianceCategory[];
    generatedAt: Date | string;
    firmwareVersion?: string;
    systemInfo?: SystemInfo;
  };
  deviceInfo: {
    name: string;
    url?: string;
    vendor?: string;
  };
  logoBase64?: string;
}

export const FirewallPDF: React.FC<FirewallPDFProps> = ({
  report,
  deviceInfo,
  logoBase64,
}) => {
  const generatedDate = report.generatedAt instanceof Date
    ? report.generatedAt
    : new Date(report.generatedAt);

  const dateString = generatedDate.toLocaleString('pt-BR');

  // Extract all failed checks as issues
  const issues: Issue[] = report.categories
    .flatMap((cat) => cat.checks)
    .filter((check) => check.status === 'fail')
    .map((check) => ({
      name: check.name,
      description: check.description,
      severity: (check.severity || 'medium') as Issue['severity'],
      category: undefined,
    }));

  // Prepare firewall info data
  const firewallInfoData = {
    vendor: deviceInfo.vendor || report.systemInfo?.vendor,
    model: report.systemInfo?.model,
    serialNumber: report.systemInfo?.serial,
    firmware: report.firmwareVersion,
    hostname: report.systemInfo?.hostname,
    uptime: report.systemInfo?.uptime,
    url: deviceInfo.url,
  };

  return (
    <Document
      title={`iScope 360 - ${deviceInfo.name}`}
      author="Precisio Analytics"
      subject="Relatório de Compliance de Firewall"
      keywords="compliance, security, firewall, fortigate"
    >
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          {/* Header */}
          <PDFHeader
            title="iScope 360"
            subtitle={deviceInfo.vendor || 'FortiGate'}
            target={deviceInfo.name}
            date={dateString}
            reportType="Relatório de Compliance"
            logoBase64={logoBase64}
          />

          {/* Hero Section: Score + Stats */}
          <View style={pageStyles.heroSection}>
            <View style={pageStyles.scoreColumn}>
              <PDFScoreGauge score={report.overallScore} />
            </View>
            <View style={pageStyles.statsColumn}>
              <PDFComplianceStats
                total={report.totalChecks}
                passed={report.passed}
                failed={report.failed}
                warnings={report.warnings}
              />
              
              {/* Firewall Info Panel */}
              <PDFFirewallInfo data={firewallInfoData} />
            </View>
          </View>

          {/* Issues Summary */}
          <PDFIssuesSummary issues={issues} maxItems={10} />
        </View>

        <PDFFooter />
      </Page>

      {/* Categories Pages */}
      {report.categories.map((category, index) => {
        const checks: Check[] = category.checks.map((check) => ({
          name: check.name,
          status: check.status as Check['status'],
          severity: check.severity as Check['severity'],
          description: check.description,
          recommendation: check.recommendation,
        }));

        return (
          <Page key={index} size="A4" style={pageStyles.page}>
            <View style={pageStyles.content}>
              <Text style={pageStyles.sectionTitle}>
                {category.name}
              </Text>
              
              {/* Aviso de Segurança - apenas na primeira categoria */}
              {index === 0 && (
                <View style={pageStyles.securityNotice}>
                  <View style={pageStyles.noticeIcon}>
                    <Text style={pageStyles.noticeIconText}>i</Text>
                  </View>
                  <Text style={pageStyles.noticeText}>
                    Por questões de segurança, as evidências coletadas não são exibidas em relatórios exportados para PDF.
                  </Text>
                </View>
              )}
              
              <PDFCategorySection
                name={category.name}
                checks={checks}
                showPassedChecks={false}
              />
            </View>

            <PDFFooter />
          </Page>
        );
      })}
    </Document>
  );
};
