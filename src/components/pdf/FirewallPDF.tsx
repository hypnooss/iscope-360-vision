import React, { useMemo } from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  baseStyles,
  radius,
} from './styles/pdfStyles';
import {
  PDFHeader,
  PDFScoreGauge,
  PDFIssuesSummary,
  PDFCategorySection,
  PDFCategorySummaryTable,
  PDFFooter,
} from './sections';
import { PDFStatusIcon } from './shared/PDFStatusIcon';
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
  // Stats row - matching ExternalDomainPDF style
  statsRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    alignItems: 'center',
    borderWidth: 1,
    borderTopWidth: 4,
  },
  statValue: {
    fontSize: 24,
    fontFamily: typography.bold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  // Device Info Section - matching PDFDomainInfo style
  infoSection: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  infoTitle: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.itemGap,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '50%',
    paddingVertical: spacing.tight,
    paddingRight: spacing.itemGap,
  },
  infoLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: typography.bold,
  },
  // Status Cards Section (Licensing & Firmware)
  statusSection: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  statusTitle: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.itemGap,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.itemGap,
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.itemGap,
    backgroundColor: colors.pageBg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusItemLabel: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
  statusItemValue: {
    fontSize: typography.caption,
    color: colors.textMuted,
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
    status: 'pass' | 'fail' | 'warning' | 'pending' | 'unknown';
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description?: string;
    recommendation?: string;
  }>;
}

interface StatusInfo {
  firmwareUpToDate?: boolean;
  licensingActive?: boolean;
  mfaEnabled?: boolean;
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
    clientName?: string;
  };
  logoBase64?: string;
  categoryConfigs?: CategoryConfig[];
  statusInfo?: StatusInfo;
}

export const FirewallPDF: React.FC<FirewallPDFProps> = ({
  report,
  deviceInfo,
  logoBase64,
  categoryConfigs,
  statusInfo,
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

  // All categories for detail pages (sorted by display_order)
  const allCategories = sortedCategories;

  // Device info values
  const vendor = deviceInfo.vendor || report.systemInfo?.vendor;
  const model = report.systemInfo?.model;
  const serialNumber = report.systemInfo?.serial;
  const firmware = report.firmwareVersion;
  const hostname = report.systemInfo?.hostname;
  const uptime = report.systemInfo?.uptime;
  const url = deviceInfo.url;

  return (
    <Document
      title={`iScope 360 - ${deviceInfo.name}`}
      author="Precisio Analytics"
      subject="Relatório de Análise de Firewall - Fortigate"
      keywords="compliance, security, firewall, fortigate"
    >
      {/* PAGE 1: Executive Summary */}
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          {/* Header */}
          <PDFHeader
            title="iScope 360"
            subtitle={deviceInfo.clientName}
            target={deviceInfo.name}
            date={dateString}
            reportType="Análise de Firewall - Fortigate"
            logoBase64={logoBase64}
          />

          {/* Hero Section: Score + Stats + Device Info */}
          <View style={pageStyles.heroSection}>
            <View style={pageStyles.scoreColumn}>
              <PDFScoreGauge score={report.overallScore} />
            </View>
            <View style={pageStyles.statsColumn}>
              {/* Stats Row - 3 cards like ExternalDomainPDF */}
              <View style={pageStyles.statsRow}>
                <View style={[pageStyles.statCard, { borderTopColor: colors.info, borderColor: colors.info }]}>
                  <Text style={[pageStyles.statValue, { color: colors.info }]}>{report.totalChecks}</Text>
                  <Text style={pageStyles.statLabel}>Total</Text>
                </View>
                <View style={[pageStyles.statCard, { borderTopColor: colors.success, borderColor: colors.success }]}>
                  <Text style={[pageStyles.statValue, { color: colors.success }]}>{report.passed}</Text>
                  <Text style={pageStyles.statLabel}>Aprovadas</Text>
                </View>
                <View style={[pageStyles.statCard, { borderTopColor: colors.danger, borderColor: colors.danger }]}>
                  <Text style={[pageStyles.statValue, { color: colors.danger }]}>{report.failed}</Text>
                  <Text style={pageStyles.statLabel}>Falhas</Text>
                </View>
              </View>
              
              {/* Device Info Panel - matching PDFDomainInfo style */}
              <View style={pageStyles.infoSection}>
                <Text style={pageStyles.infoTitle}>Informações do Dispositivo</Text>
                
                <View style={pageStyles.infoGrid}>
                  {vendor && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Fabricante</Text>
                      <Text style={pageStyles.infoValue}>{vendor}</Text>
                    </View>
                  )}
                  
                  {model && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Modelo</Text>
                      <Text style={pageStyles.infoValue}>{model}</Text>
                    </View>
                  )}
                  
                  {serialNumber && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Número de Série</Text>
                      <Text style={pageStyles.infoValue}>{serialNumber}</Text>
                    </View>
                  )}
                  
                  {firmware && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Firmware</Text>
                      <Text style={pageStyles.infoValue}>{firmware}</Text>
                    </View>
                  )}
                  
                  {hostname && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Hostname</Text>
                      <Text style={pageStyles.infoValue}>{hostname}</Text>
                    </View>
                  )}
                  
                  {uptime && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>Uptime</Text>
                      <Text style={pageStyles.infoValue}>{uptime}</Text>
                    </View>
                  )}
                  
                  {url && (
                    <View style={pageStyles.infoItem}>
                      <Text style={pageStyles.infoLabel}>URL de Acesso</Text>
                      <Text style={pageStyles.infoValue}>{url}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Status Cards Section - Licensing & Firmware */}
              <View style={pageStyles.statusSection}>
                <Text style={pageStyles.statusTitle}>Licenciamento e Firmware</Text>
                
                <View style={pageStyles.statusGrid}>
                  {/* Firmware */}
                  <View style={pageStyles.statusItem}>
                    <PDFStatusIcon status={statusInfo?.firmwareUpToDate ? 'pass' : 'fail'} size={12} />
                    <View>
                      <Text style={pageStyles.statusItemLabel}>Firmware</Text>
                      <Text style={pageStyles.statusItemValue}>
                        {statusInfo?.firmwareUpToDate ? 'Atualizado' : 'Desatualizado'}
                      </Text>
                    </View>
                  </View>

                  {/* Licensing */}
                  <View style={pageStyles.statusItem}>
                    <PDFStatusIcon status={statusInfo?.licensingActive ? 'pass' : 'fail'} size={12} />
                    <View>
                      <Text style={pageStyles.statusItemLabel}>Licenciamento</Text>
                      <Text style={pageStyles.statusItemValue}>
                        {statusInfo?.licensingActive ? 'Ativo' : 'Expirado'}
                      </Text>
                    </View>
                  </View>

                  {/* MFA */}
                  <View style={pageStyles.statusItem}>
                    <PDFStatusIcon status={statusInfo?.mfaEnabled ? 'pass' : 'fail'} size={12} />
                    <View>
                      <Text style={pageStyles.statusItemLabel}>MFA</Text>
                      <Text style={pageStyles.statusItemValue}>
                        {statusInfo?.mfaEnabled ? 'Ativo' : 'Inativo'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Category Summary Table - on Page 1 */}
          <PDFCategorySummaryTable categories={categorySummaries} />

          {/* Issues Summary - on Page 1 */}
          {issues.length > 0 && (
            <PDFIssuesSummary issues={issues} maxItems={20} />
          )}
        </View>

        <PDFFooter />
      </Page>

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
