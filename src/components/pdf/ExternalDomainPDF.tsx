import React, { useMemo } from 'react';
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
import { CategoryConfig, getCategoryConfig, getColorHexByName, DEFAULT_CATEGORY_CONFIGS } from '@/hooks/useCategoryConfig';

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
  categoryConfigs?: CategoryConfig[];
}

export const ExternalDomainPDF: React.FC<ExternalDomainPDFProps> = ({
  report,
  domainInfo,
  dnsSummary,
  emailAuth,
  logoBase64,
  categoryConfigs,
}) => {
  const generatedDate = report.generatedAt instanceof Date
    ? report.generatedAt
    : new Date(report.generatedAt);

  const dateString = generatedDate.toLocaleString('pt-BR');

  // Sort categories by display_order from configs
  const sortedCategories = useMemo(() => {
    return [...report.categories].sort((a, b) => {
      const configA = categoryConfigs?.find(c => c.name === a.name);
      const configB = categoryConfigs?.find(c => c.name === b.name);
      return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
    });
  }, [report.categories, categoryConfigs]);

  // Helper to get color for a category (from configs or fallback)
  const getColorForCategory = (categoryName: string): string => {
    const config = categoryConfigs?.find(c => c.name === categoryName);
    if (config) {
      return getColorHexByName(config.color);
    }
    // Fallback to default configs
    const defaultConfig = DEFAULT_CATEGORY_CONFIGS[categoryName];
    if (defaultConfig) {
      return getColorHexByName(defaultConfig.color);
    }
    return colors.primary;
  };

  // Extract all failed checks as issues
  const issues: Issue[] = sortedCategories
    .flatMap((cat) => cat.checks)
    .filter((check) => check.status === 'fail')
    .map((check) => ({
      name: check.name,
      description: check.description,
      severity: (check.severity || 'medium') as Issue['severity'],
      category: undefined,
    }));

  // Prepare category summaries for the table (using displayName from configs)
  const categorySummaries: CategorySummary[] = sortedCategories.map((cat) => {
    const config = getCategoryConfig(categoryConfigs, cat.name);
    const passed = cat.checks.filter((c) => c.status === 'pass').length;
    const failed = cat.checks.filter((c) => c.status === 'fail').length;
    const total = cat.checks.length;
    return {
      name: config.displayName, // Use displayName from config
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

  // All categories for detail pages (sorted by display_order)
  const allCategories = sortedCategories;

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
        </View>

        <PDFFooter />
      </Page>

      {/* PAGE 2: Issues Summary */}
      {issues.length > 0 && (
        <Page size="A4" style={pageStyles.page}>
          <View style={pageStyles.content}>
            <PDFIssuesSummary issues={issues} maxItems={20} />
          </View>

          <PDFFooter />
        </Page>
      )}

      {/* PAGE 2+: Category Details */}
      {allCategories.length > 0 && (
        <Page size="A4" style={pageStyles.page} wrap>
          <View style={pageStyles.content}>
            <Text style={pageStyles.pageTitle}>
              Detalhamento por Categoria
            </Text>
            
            {/* Aviso de Segurança */}
            <View style={pageStyles.securityNotice}>
              <View style={pageStyles.noticeIcon}>
                <Text style={pageStyles.noticeIconText}>i</Text>
              </View>
              <Text style={pageStyles.noticeText}>
                Por questões de segurança, as evidências coletadas não são exibidas em relatórios exportados para PDF.
              </Text>
            </View>
            
            {allCategories.map((category, index) => {
              const config = getCategoryConfig(categoryConfigs, category.name);
              const checks: Check[] = category.checks.map((check) => ({
                name: check.name,
                status: check.status as Check['status'],
                severity: check.severity as Check['severity'],
                description: check.description,
                recommendation: check.recommendation,
              }));

              // Get color from config or fallback
              const color = getColorForCategory(category.name);

              return (
                <PDFCategorySection
                  key={index}
                  name={config.displayName} // Use displayName from config
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
