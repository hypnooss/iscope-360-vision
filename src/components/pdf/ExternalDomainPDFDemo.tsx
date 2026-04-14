import React, { useMemo } from 'react';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { Document, Page, View, Text, StyleSheet, Svg, Path } from '@react-pdf/renderer';
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
  page: { ...baseStyles.page, paddingBottom: 60 },
  content: { flex: 1 },
});

// Obfuscation styles — improved blur effect
const obfuscatedStyles = StyleSheet.create({
  wrapper: { position: 'relative', minHeight: 500 },
  blurredContent: { opacity: 0.18 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  overlayBox: {
    backgroundColor: '#FFFFFF', borderRadius: 8, padding: 32,
    alignItems: 'center', borderWidth: 2, borderColor: colors.primary, maxWidth: 360,
  },
  overlayDemoTag: {
    fontSize: 11, fontWeight: 700, color: colors.primary,
    letterSpacing: 2, marginBottom: 8,
  },
  overlayTitle: {
    fontSize: typography.heading, fontWeight: 700,
    color: colors.primary, marginBottom: 8, textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: typography.body, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: typography.subheading, fontWeight: 700,
    color: '#64748B', marginBottom: 12, marginHorizontal: 16,
  },
});

const LockIcon: React.FC = () => (
  <Svg viewBox="0 0 24 24" width={24} height={24}>
    <Path
      d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"
      fill={colors.primary}
    />
  </Svg>
);

/** Simulated blurred line with varying widths */
const BlurLine: React.FC<{ width?: string }> = ({ width = '100%' }) => (
  <View style={{ height: 8, backgroundColor: '#334155', borderRadius: 2, marginBottom: 6, marginHorizontal: 16, width }} />
);

const BlurBlock: React.FC = () => (
  <View style={{ height: 50, backgroundColor: '#475569', borderRadius: 6, marginBottom: 10, marginHorizontal: 16 }} />
);

/** Renders a realistic blurred page representing obfuscated content */
const ObfuscatedPage: React.FC<{ title: string }> = ({ title }) => (
  <Page size="A4" style={pageStyles.page}>
    <View style={obfuscatedStyles.wrapper}>
      <View style={obfuscatedStyles.blurredContent}>
        <Text style={obfuscatedStyles.sectionTitle}>{title}</Text>
        <BlurBlock />
        <BlurLine width="90%" />
        <BlurLine width="55%" />
        <BlurLine width="75%" />
        <BlurBlock />
        <BlurLine width="85%" />
        <BlurLine width="40%" />
        <BlurLine width="70%" />
        <BlurBlock />
        <BlurLine width="60%" />
        <BlurLine width="45%" />
        <BlurLine width="80%" />
        <BlurBlock />
        <BlurLine width="50%" />
        <BlurLine width="65%" />
      </View>
      <View style={obfuscatedStyles.overlay}>
        <View style={obfuscatedStyles.overlayBox}>
          <LockIcon />
          <Text style={obfuscatedStyles.overlayDemoTag}>VERSAO DEMO</Text>
          <Text style={obfuscatedStyles.overlayTitle}>
            Conteudo disponivel na versao completa
          </Text>
          <Text style={obfuscatedStyles.overlaySubtitle}>
            Adquira o relatorio completo para acessar o guia detalhado de correcoes, subdominios descobertos e plano de acao.
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
      title={`Precisio - ${domainInfo.name} (Demo)`}
      author="Precisio Analytics"
      subject="Relatorio de Analise de Dominio Externo (Demo)"
    >
      {/* PAGE 1: Executive Summary - FULL */}
      <Page size="A4" style={pageStyles.page}>
        <View style={pageStyles.content}>
          <PDFHeader
            title="Precisio"
            subtitle={domainInfo.clientName}
            target={domainInfo.domain}
            date={dateString}
            reportType="Analise de Dominio Externo"
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
      <ObfuscatedPage title="Subdominios Descobertos" />
      <ObfuscatedPage title="Guia de Correcoes" />
      <ObfuscatedPage title="Verificacoes Aprovadas" />
      <ObfuscatedPage title="Plano de Acao" />
    </Document>
  );
};
