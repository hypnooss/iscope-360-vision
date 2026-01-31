import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
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
  PDFDomainInfo,
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
});

// Types
interface EmailAuthStatus {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
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

interface ExternalDomainPDFProps {
  report: {
    overallScore: number;
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    categories: ComplianceCategory[];
    generatedAt: Date | string;
  };
  domainInfo: {
    name: string;
    domain: string;
    clientName?: string;
  };
  dnsSummary?: DnsSummary;
  emailAuth?: EmailAuthStatus;
  logoBase64?: string;
}

export const ExternalDomainPDF: React.FC<ExternalDomainPDFProps> = ({
  report,
  domainInfo,
  dnsSummary,
  emailAuth,
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

  // Prepare domain info data for PDFDomainInfo
  const domainInfoData = {
    soa: dnsSummary?.soaMname || undefined,
    nameservers: dnsSummary?.ns,
    contactEmail: dnsSummary?.soaContact || undefined,
    dnssec: dnsSummary?.dnssecHasDnskey && dnsSummary?.dnssecHasDs,
    spf: emailAuth ? { valid: emailAuth.spf } : undefined,
    dkim: emailAuth ? { valid: emailAuth.dkim } : undefined,
    dmarc: emailAuth ? { valid: emailAuth.dmarc } : undefined,
  };

  return (
    <Document
      title={`iScope 360 - ${domainInfo.name}`}
      author="Precisio Analytics"
      subject="Relatório de Análise de Domínio Externo"
      keywords="compliance, security, domain, dns, email"
    >
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          {/* Header */}
          <PDFHeader
            title="iScope 360"
            subtitle={domainInfo.clientName}
            target={domainInfo.domain}
            date={dateString}
            reportType="Análise de Domínio Externo"
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
              
              {/* Domain Info Panel */}
              <PDFDomainInfo data={domainInfoData} />
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
                Verificações por Categoria
              </Text>
              
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
