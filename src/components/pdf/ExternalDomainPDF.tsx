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
  PDFDomainInfo,
  PDFIssuesSummary,
  PDFCategorySection,
  PDFCategorySummaryTable,
  PDFFooter,
} from './sections';
import type { Issue, Check, CategorySummary } from './sections';

// Page styles
const pageStyles = StyleSheet.create({
  page: {
    ...baseStyles.page,
    paddingBottom: 60, // Space for footer
  },
  content: {
    flex: 1,
  },
  // Page 1: Executive Summary
  heroSection: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: spacing.sectionGap,
  },
  scoreColumn: {
    width: 180,
    alignItems: 'center',
  },
  statsColumn: {
    flex: 1,
  },
  // Categories Section
  sectionTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.itemGap,
    marginTop: spacing.sectionGap,
    paddingBottom: spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.sectionGap,
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

  // Prepare category summaries for the table
  const categorySummaries: CategorySummary[] = report.categories.map((cat) => {
    const passed = cat.checks.filter((c) => c.status === 'pass').length;
    const failed = cat.checks.filter((c) => c.status === 'fail').length;
    const total = cat.checks.length;
    return {
      name: cat.name,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      passed,
      failed,
      total,
    };
  });

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

  // Group categories for multi-column layout on detail pages
  const categoriesWithFailures = report.categories.filter(
    (cat) => cat.checks.some((c) => c.status === 'fail')
  );

  return (
    <Document
      title={`iScope 360 - ${domainInfo.name}`}
      author="Precisio Analytics"
      subject="Relatório de Análise de Domínio Externo"
      keywords="compliance, security, domain, dns, email"
    >
      {/* PAGE 1: Executive Summary */}
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

          {/* Hero Section: Score + Stats + Domain Info */}
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

          {/* Category Summary Table */}
          <PDFCategorySummaryTable categories={categorySummaries} />

          {/* Issues Summary (if any) */}
          {issues.length > 0 && (
            <PDFIssuesSummary issues={issues} maxItems={8} />
          )}
        </View>

        <PDFFooter />
      </Page>

      {/* PAGE 2+: Category Details */}
      {categoriesWithFailures.length > 0 && (
        <Page size="A4" style={pageStyles.page} wrap>
          <View style={pageStyles.content}>
            <Text style={pageStyles.pageTitle}>
              Detalhamento por Categoria
            </Text>
            
            {categoriesWithFailures.map((category, index) => {
              const checks: Check[] = category.checks.map((check) => ({
                name: check.name,
                status: check.status as Check['status'],
                severity: check.severity as Check['severity'],
                description: check.description,
                recommendation: check.recommendation,
              }));

              // Category colors
              const categoryColors: Record<string, string> = {
                'Segurança DNS': colors.categoryDns,
                'Infraestrutura de Email': colors.categoryEmail,
                'Autenticação de Email - SPF': colors.categorySpf,
                'Autenticação de Email - DKIM': colors.categoryDkim,
                'Autenticação de Email - DMARC': colors.categoryDmarc,
              };

              const color = categoryColors[category.name] || colors.primary;

              return (
                <PDFCategorySection
                  key={index}
                  name={category.name}
                  checks={checks}
                  color={color}
                  showPassedChecks={true}
                />
              );
            })}
          </View>

          <PDFFooter />
        </Page>
      )}
    </Document>
  );
};
