import React from 'react';
import { Document, Page, View, Text, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  baseStyles,
} from './styles/pdfStyles';
import { PDFHeader, PDFFooter } from './sections';
import type { AttackSurfaceSnapshot } from '@/hooks/useAttackSurfaceData';

const s = StyleSheet.create({
  page: { ...baseStyles.page, paddingBottom: 60 },
  content: { flex: 1 },
  pageTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.sectionGap,
  },
  statsRow: { flexDirection: 'row', gap: spacing.cardGap, marginBottom: spacing.sectionGap },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 22, fontFamily: typography.bold, color: colors.primary, marginBottom: 2 },
  statLabel: { fontSize: typography.tiny, color: colors.textMuted, textTransform: 'uppercase' },
  scoreContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sectionGap },
  scoreValue: { fontSize: 48, fontFamily: typography.bold },
  scoreLabel: { fontSize: typography.caption, color: colors.textMuted, marginTop: 4 },
  ipCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ipTitle: { fontSize: typography.body, fontFamily: typography.bold, color: colors.textPrimary, marginBottom: 4 },
  ipMeta: { fontSize: typography.bodySmall, color: colors.textSecondary, marginBottom: 2 },
  // CVE sample styles
  cveSection: { marginTop: 16 },
  cveCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cveBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
    minWidth: 55,
    alignItems: 'center',
  },
  cveBadgeText: { fontSize: 8, fontFamily: typography.bold, color: '#FFFFFF' },
  cveId: { fontSize: typography.bodySmall, fontFamily: typography.bold, color: colors.textPrimary, marginRight: 8, minWidth: 110 },
  cveTitle: { fontSize: typography.bodySmall, color: colors.textSecondary, flex: 1 },
  cveScore: { fontSize: typography.bodySmall, fontFamily: typography.bold, marginLeft: 8, minWidth: 30, textAlign: 'right' },
  cveMore: { fontSize: typography.bodySmall, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});

// Obfuscation styles — improved blur effect
const obfStyles = StyleSheet.create({
  wrapper: { position: 'relative', minHeight: 500 },
  blurred: { opacity: 0.18 },
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
    fontSize: 11, fontFamily: typography.bold, color: colors.primary,
    letterSpacing: 2, marginBottom: 8,
  },
  overlayTitle: {
    fontSize: typography.heading, fontFamily: typography.bold,
    color: colors.primary, marginBottom: 8, textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: typography.body, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 1.5,
  },
  title: {
    fontSize: typography.subheading, fontFamily: typography.bold,
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

const ObfuscatedPage: React.FC<{ title: string }> = ({ title }) => (
  <Page size="A4" style={s.page}>
    <View style={obfStyles.wrapper}>
      <View style={obfStyles.blurred}>
        <Text style={obfStyles.title}>{title}</Text>
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
      <View style={obfStyles.overlay}>
        <View style={obfStyles.overlayBox}>
          <LockIcon />
          <Text style={obfStyles.overlayDemoTag}>VERSAO DEMO</Text>
          <Text style={obfStyles.overlayTitle}>Conteudo disponivel na versao completa</Text>
          <Text style={obfStyles.overlaySubtitle}>
            Adquira o relatorio completo para acessar servicos detectados, vulnerabilidades e web services.
          </Text>
        </View>
      </View>
    </View>
    <PDFFooter />
  </Page>
);

const getScoreColor = (score: number | null) => {
  if (!score) return colors.textMuted;
  if (score >= 75) return colors.primary;
  if (score >= 50) return colors.warning;
  return colors.danger;
};

const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#d97706';
    case 'low': return '#16a34a';
    default: return '#64748b';
  }
};

interface SurfaceAnalyzerPDFDemoProps {
  snapshot: AttackSurfaceSnapshot;
  domainName: string;
  dateString: string;
  clientName?: string;
  logoBase64?: string;
}

export const SurfaceAnalyzerPDFDemo: React.FC<SurfaceAnalyzerPDFDemoProps> = ({
  snapshot,
  domainName,
  dateString,
  clientName,
  logoBase64,
}) => {
  const { summary, source_ips, results, score, cve_matches } = snapshot;

  // Show up to 5 CVEs without linking to assets
  const sampleCves = (cve_matches || []).slice(0, 5);
  const remainingCves = Math.max(0, (cve_matches || []).length - 5);

  return (
    <Document
      title={`Precisio - Surface Analyzer - ${domainName} (Demo)`}
      author="Precisio Analytics"
      subject="Relatorio de Superficie de Ataque (Demo)"
    >
      {/* PAGE 1: Overview — FULL */}
      <Page size="A4" style={s.page}>
        <View style={s.content}>
          <PDFHeader
            title="Precisio"
            subtitle={clientName}
            target={domainName}
            date={dateString}
            reportType="Surface Analyzer"
            logoBase64={logoBase64}
          />

          {score != null && (
            <View style={s.scoreContainer}>
              <Text style={[s.scoreValue, { color: getScoreColor(score) }]}>
                {score}/100
              </Text>
              <Text style={s.scoreLabel}>SCORE DE SUPERFICIE DE ATAQUE</Text>
            </View>
          )}

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{summary.total_ips}</Text>
              <Text style={s.statLabel}>IPs</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{summary.open_ports}</Text>
              <Text style={s.statLabel}>Portas</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>{summary.services}</Text>
              <Text style={s.statLabel}>Servicos</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: summary.cves > 0 ? colors.danger : colors.primary }]}>
                {summary.cves}
              </Text>
              <Text style={s.statLabel}>CVEs</Text>
            </View>
          </View>

          {/* Assets — show first 6 only */}
          <Text style={s.pageTitle}>Assets Descobertos</Text>
          {source_ips.slice(0, 6).map((sip, i) => {
            const res = results[sip.ip];
            return (
              <View key={i} style={s.ipCard} wrap={false}>
                <Text style={s.ipTitle}>{sip.ip} ({sip.label})</Text>
                {res && (
                  <>
                    {res.hostnames?.length > 0 && (
                      <Text style={s.ipMeta}>Hostnames: {res.hostnames.join(', ')}</Text>
                    )}
                    {res.os && <Text style={s.ipMeta}>OS: {res.os}</Text>}
                    <Text style={s.ipMeta}>Portas: {res.ports?.join(', ') || 'N/A'}</Text>
                  </>
                )}
              </View>
            );
          })}

          {/* CVE Sample — show up to 5 without asset linkage */}
          {sampleCves.length > 0 && (
            <View style={s.cveSection}>
              <Text style={s.pageTitle}>Vulnerabilidades Encontradas (amostra)</Text>
              {sampleCves.map((cve, i) => (
                <View key={i} style={s.cveCard} wrap={false}>
                  <View style={[s.cveBadge, { backgroundColor: getSeverityColor(cve.severity) }]}>
                    <Text style={s.cveBadgeText}>{(cve.severity || 'N/A').toUpperCase()}</Text>
                  </View>
                  <Text style={s.cveId}>{cve.cve_id}</Text>
                  <Text style={s.cveTitle} numberOfLines={1}>{cve.title || 'Sem titulo'}</Text>
                  <Text style={[s.cveScore, { color: getSeverityColor(cve.severity) }]}>
                    {cve.score != null ? cve.score.toFixed(1) : '-'}
                  </Text>
                </View>
              ))}
              {remainingCves > 0 && (
                <Text style={s.cveMore}>...e mais {remainingCves} vulnerabilidades no relatorio completo</Text>
              )}
            </View>
          )}
        </View>
        <PDFFooter />
      </Page>

      {/* OBFUSCATED PAGES */}
      <ObfuscatedPage title="Servicos Detectados" />
      <ObfuscatedPage title="Vulnerabilidades (CVEs)" />
      <ObfuscatedPage title="Web Services" />
    </Document>
  );
};
