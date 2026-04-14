import React, { useMemo } from 'react';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  baseStyles,
} from './styles/pdfStyles';
import {
  PDFHeader,
  PDFDomainInfo,
  PDFCategorySummaryTable,
  PDFFooter,
  PDFDNSMap,
  PDFHowToRead,
  PDFPostureOverview,
} from './sections';
import type { CategorySummary } from './sections';
import { CategoryConfig, getCategoryConfig } from '@/hooks/useCategoryConfig';
import { severityToPriority } from './data/explanatoryContent';

// Reuse types from the full PDF
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

interface SubdomainSummary {
  total_found: number;
  subdomains: Array<{
    subdomain: string;
    sources: string[];
    addresses: Array<{ ip: string; type?: string }>;
    is_alive?: boolean;
  }>;
  sources: string[];
  mode: string;
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

interface ExternalDomainPDFDemoProps {
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
  subdomainSummary?: SubdomainSummary;
  logoBase64?: string;
  categoryConfigs?: CategoryConfig[];
}

const pageStyles = StyleSheet.create({
  page: {
    ...baseStyles.page,
    paddingBottom: 60,
  },
  content: {
    flex: 1,
  },
});

const obfuscatedStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    minHeight: 500,
  },
  blurredContent: {
    opacity: 0.06,
  },
  blurredLine: {
    height: 10,
    backgroundColor: '#94A3B8',
    borderRadius: 3,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  blurredLineShort: {
    height: 10,
    backgroundColor: '#94A3B8',
    borderRadius: 3,
    marginBottom: 8,
    marginHorizontal: 16,
    width: '60%',
  },
  blurredBlock: {
    height: 60,
    backgroundColor: '#CBD5E1',
    borderRadius: 6,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  overlayBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    maxWidth: 360,
  },
  lockIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  overlayTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: '#CBD5E1',
    marginBottom: 12,
    marginHorizontal: 16,
  },
});

/** Renders a fake blurred page representing obfuscated content */
const ObfuscatedPage: React.FC<{ title: string }> = ({ title }) => (
  <Page size="A4" style={pageStyles.page}>
    <View style={obfuscatedStyles.wrapper}>
      <View style={obfuscatedStyles.blurredContent}>
        <Text style={obfuscatedStyles.sectionTitle}>{title}</Text>
        {/* Simulated content blocks */}
        <View style={obfuscatedStyles.blurredBlock} />
        <View style={obfuscatedStyles.blurredLine} />
        <View style={obfuscatedStyles.blurredLineShort} />
        <View style={obfuscatedStyles.blurredLine} />
        <View style={obfuscatedStyles.blurredBlock} />
        <View style={obfuscatedStyles.blurredLine} />
        <View style={obfuscatedStyles.blurredLineShort} />
        <View style={obfuscatedStyles.blurredLine} />
        <View style={obfuscatedStyles.blurredBlock} />
        <View style={obfuscatedStyles.blurredLine} />
        <View style={obfuscatedStyles.blurredLineShort} />
      </View>
      <View style={obfuscatedStyles.overlay}>
        <View style={obfuscatedStyles.overlayBox}>
          <Text style={obfuscatedStyles.lockIcon}>🔒</Text>
          <Text style={obfuscatedStyles.overlayTitle}>
            Conteúdo disponível na versão completa
          </Text>
          <Text style={obfuscatedStyles.overlaySubtitle}>
            Adquira o relatório completo para acessar o guia detalhado de correções, subdomínios descobertos e plano de ação.
          </Text>
        </View>
      </View>
    </View>
    <PDFFooter />
  </Page>
);

export const ExternalDomainPDFDemo: React.FC<ExternalDomainPDFDemoProps> = ({
  report,
  domainInfo,
  dnsSummary,
  emailAuth,
  subdomainSummary,
  logoBase64,
  categoryConfigs,
}) => {
  const generatedDate = report.generatedAt instanceof Date
    ? report.generatedAt
    : new Date(report.generatedAt);

  const dateString = formatDateTimeBR(generatedDate);

  const sortedCategories = useMemo(() => {
    return [...report.categories].sort((a, b) => {
      const configA = categoryConfigs?.find(c => c.name === a.name);
      const configB = categoryConfigs?.find(c => c.name === b.name);
      return (configA?.display_order ?? 999) - (configB?.display_order ?? 999);
    });
  }, [report.categories, categoryConfigs]);

  const categorizedChecks = useMemo(() => {
    let critical = 0, recommended = 0, ok = 0;
    sortedCategories.forEach(cat => {
      cat.checks.forEach(check => {
        if (check.status === 'pass') ok++;
        else if (severityToPriority(check.severity) === 'critical') critical++;
        else recommended++;
      });
    });
    return { critical, recommended, ok };
  }, [sortedCategories]);

  const categorySummaries: CategorySummary[] = sortedCategories.map((cat) => {
    const config = getCategoryConfig(categoryConfigs, cat.name);
    const passedCount = cat.checks.filter((c) => c.status === 'pass').length;
    const failedCount = cat.checks.filter((c) => c.status === 'fail').length;
    const total = cat.checks.length;
    return {
      name: config.displayName,
      passRate: total > 0 ? Math.round((passedCount / total) * 100) : 0,
      passed: passedCount,
      failed: failedCount,
      total,
    };
  });

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
      title={`iScope 360 - ${domainInfo.name} (Demo)`}
      author="Precisio Analytics"
      subject="Relatório de Análise de Domínio Externo (Demo)"
    >
      {/* PAGE 1: Executive Summary - FULL */}
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          <PDFHeader
            title="iScope 360"
            subtitle={domainInfo.clientName}
            target={domainInfo.domain}
            date={dateString}
            reportType="Análise de Domínio Externo"
            logoBase64={logoBase64}
          />
          <PDFHowToRead />
          <PDFPostureOverview
            counts={categorizedChecks}
            domainName={domainInfo.domain}
          />
        </View>
        <PDFFooter />
      </Page>

      {/* PAGE 2: Infrastructure Summary - FULL */}
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          <PDFDomainInfo data={domainInfoData} />
          <PDFCategorySummaryTable categories={categorySummaries} />
        </View>
        <PDFFooter />
      </Page>

      {/* PAGE 3: DNS Map - FULL */}
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          <PDFDNSMap
            dnsSummary={dnsSummary}
            emailAuth={emailAuth}
            subdomainSummary={subdomainSummary}
            categories={report.categories}
          />
        </View>
        <PDFFooter />
      </Page>

      {/* OBFUSCATED PAGES */}
      <ObfuscatedPage title="Subdomínios Descobertos" />
      <ObfuscatedPage title="Guia de Correções" />
      <ObfuscatedPage title="Verificações Aprovadas" />
      <ObfuscatedPage title="Plano de Ação" />
    </Document>
  );
};
