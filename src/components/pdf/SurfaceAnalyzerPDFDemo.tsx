import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
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
});

const obfStyles = StyleSheet.create({
  wrapper: { position: 'relative', minHeight: 500 },
  blurred: { opacity: 0.06 },
  line: { height: 10, backgroundColor: '#94A3B8', borderRadius: 3, marginBottom: 8, marginHorizontal: 16 },
  lineShort: { height: 10, backgroundColor: '#94A3B8', borderRadius: 3, marginBottom: 8, marginHorizontal: 16, width: '60%' },
  block: { height: 60, backgroundColor: '#CBD5E1', borderRadius: 6, marginBottom: 12, marginHorizontal: 16 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  overlayBox: {
    backgroundColor: '#FFFFFF', borderRadius: 8, padding: 32,
    alignItems: 'center', borderWidth: 2, borderColor: colors.primary, maxWidth: 360,
  },
  lockIcon: { fontSize: 28, marginBottom: 12 },
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
    color: '#CBD5E1', marginBottom: 12, marginHorizontal: 16,
  },
});

const ObfuscatedPage: React.FC<{ title: string }> = ({ title }) => (
  <Page size="A4" style={s.page}>
    <View style={obfStyles.wrapper}>
      <View style={obfStyles.blurred}>
        <Text style={obfStyles.title}>{title}</Text>
        <View style={obfStyles.block} />
        <View style={obfStyles.line} />
        <View style={obfStyles.lineShort} />
        <View style={obfStyles.block} />
        <View style={obfStyles.line} />
        <View style={obfStyles.lineShort} />
        <View style={obfStyles.block} />
        <View style={obfStyles.line} />
      </View>
      <View style={obfStyles.overlay}>
        <View style={obfStyles.overlayBox}>
          <Text style={obfStyles.lockIcon}>🔒</Text>
          <Text style={obfStyles.overlayTitle}>Conteúdo disponível na versão completa</Text>
          <Text style={obfStyles.overlaySubtitle}>
            Adquira o relatório completo para acessar serviços detectados, vulnerabilidades e web services.
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
  const { summary, source_ips, results, score } = snapshot;

  return (
    <Document
      title={`iScope 360 - Surface Analyzer - ${domainName} (Demo)`}
      author="Precisio Analytics"
      subject="Relatório de Superfície de Ataque (Demo)"
    >
      {/* PAGE 1: Overview — FULL */}
      <Page size="A4" style={s.page}>
        <View style={s.content}>
          <PDFHeader
            title="iScope 360"
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
              <Text style={s.scoreLabel}>SCORE DE SUPERFÍCIE DE ATAQUE</Text>
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
              <Text style={s.statLabel}>Serviços</Text>
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
        </View>
        <PDFFooter />
      </Page>

      {/* OBFUSCATED PAGES */}
      <ObfuscatedPage title="Serviços Detectados" />
      <ObfuscatedPage title="Vulnerabilidades (CVEs)" />
      <ObfuscatedPage title="Web Services" />
    </Document>
  );
};
