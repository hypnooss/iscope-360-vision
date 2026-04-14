import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  baseStyles,
  getSeverityColors,
} from './styles/pdfStyles';
import { PDFHeader, PDFFooter } from './sections';
import type {
  AttackSurfaceSnapshot,
  AttackSurfaceIPResult,
  AttackSurfaceService,
  AttackSurfaceCVE,
} from '@/hooks/useAttackSurfaceData';

const s = StyleSheet.create({
  page: { ...baseStyles.page, paddingBottom: 60 },
  content: { flex: 1 },
  pageTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.sectionGap,
  },
  // Stats row
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
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    padding: 6,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    padding: 6,
    backgroundColor: colors.tableRowAlt,
  },
  th: { fontSize: typography.bodySmall, fontFamily: typography.bold, color: colors.textPrimary },
  td: { fontSize: typography.bodySmall, color: colors.textSecondary },
  // Severity badge
  badge: { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  badgeText: { fontSize: typography.tiny, fontFamily: typography.bold },
  // Score display
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sectionGap,
  },
  scoreValue: { fontSize: 48, fontFamily: typography.bold },
  scoreLabel: { fontSize: typography.caption, color: colors.textMuted, marginTop: 4 },
  // IP card
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

interface SurfaceAnalyzerPDFProps {
  snapshot: AttackSurfaceSnapshot;
  domainName: string;
  dateString: string;
  clientName?: string;
  logoBase64?: string;
}

const getScoreColor = (score: number | null) => {
  if (!score) return colors.textMuted;
  if (score >= 75) return colors.primary;
  if (score >= 50) return colors.warning;
  return colors.danger;
};

export const SurfaceAnalyzerPDF: React.FC<SurfaceAnalyzerPDFProps> = ({
  snapshot,
  domainName,
  dateString,
  clientName,
  logoBase64,
}) => {
  const { summary, source_ips, results, cve_matches, score } = snapshot;

  const allServices: Array<AttackSurfaceService & { ip: string }> = [];
  const allWebServices: Array<{ url: string; status_code: number; title: string; server: string; technologies: string[]; ip: string }> = [];

  Object.entries(results).forEach(([ip, res]) => {
    (res.services || []).forEach(svc => allServices.push({ ...svc, ip }));
    (res.web_services || []).forEach(ws => allWebServices.push({ ...ws, ip }));
  });

  return (
    <Document
      title={`iScope 360 - Surface Analyzer - ${domainName}`}
      author="Precisio Analytics"
      subject="Relatório de Superfície de Ataque"
    >
      {/* PAGE 1: Overview */}
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

          {/* Source IPs list */}
          <Text style={s.pageTitle}>Assets Descobertos</Text>
          {source_ips.slice(0, 12).map((sip, i) => {
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
                    {res.asn && <Text style={s.ipMeta}>ASN: {res.asn.provider} ({res.asn.asn})</Text>}
                    <Text style={s.ipMeta}>Portas: {res.ports?.join(', ') || 'N/A'}</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>
        <PDFFooter />
      </Page>

      {/* PAGE 2: Services Table */}
      {allServices.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <View style={s.content}>
            <Text style={s.pageTitle}>Serviços Detectados ({allServices.length})</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '15%' }]}>IP</Text>
              <Text style={[s.th, { width: '10%' }]}>Porta</Text>
              <Text style={[s.th, { width: '10%' }]}>Proto</Text>
              <Text style={[s.th, { width: '25%' }]}>Produto</Text>
              <Text style={[s.th, { width: '15%' }]}>Versão</Text>
              <Text style={[s.th, { width: '25%' }]}>Nome</Text>
            </View>
            {allServices.slice(0, 60).map((svc, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.td, { width: '15%' }]}>{svc.ip}</Text>
                <Text style={[s.td, { width: '10%' }]}>{svc.port}</Text>
                <Text style={[s.td, { width: '10%' }]}>{svc.transport}</Text>
                <Text style={[s.td, { width: '25%' }]}>{svc.product || '-'}</Text>
                <Text style={[s.td, { width: '15%' }]}>{svc.version || '-'}</Text>
                <Text style={[s.td, { width: '25%' }]}>{svc.name || '-'}</Text>
              </View>
            ))}
          </View>
          <PDFFooter />
        </Page>
      )}

      {/* PAGE 3: CVEs */}
      {cve_matches.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <View style={s.content}>
            <Text style={s.pageTitle}>Vulnerabilidades Encontradas ({cve_matches.length})</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, { width: '20%' }]}>CVE ID</Text>
              <Text style={[s.th, { width: '12%' }]}>Severity</Text>
              <Text style={[s.th, { width: '10%' }]}>Score</Text>
              <Text style={[s.th, { width: '58%' }]}>Título</Text>
            </View>
            {cve_matches.slice(0, 50).map((cve, i) => {
              const sevColors = getSeverityColors(cve.severity?.toLowerCase() || 'medium');
              return (
                <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                  <Text style={[s.td, { width: '20%', fontFamily: typography.bold }]}>{cve.cve_id}</Text>
                  <View style={{ width: '12%' }}>
                    <View style={[s.badge, { backgroundColor: sevColors.bg }]}>
                      <Text style={[s.badgeText, { color: sevColors.text }]}>{cve.severity}</Text>
                    </View>
                  </View>
                  <Text style={[s.td, { width: '10%' }]}>{cve.score ?? '-'}</Text>
                  <Text style={[s.td, { width: '58%' }]}>{cve.title || '-'}</Text>
                </View>
              );
            })}
          </View>
          <PDFFooter />
        </Page>
      )}

      {/* PAGE 4: Web Services */}
      {allWebServices.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <View style={s.content}>
            <Text style={s.pageTitle}>Web Services ({allWebServices.length})</Text>
            {allWebServices.slice(0, 30).map((ws, i) => (
              <View key={i} style={s.ipCard} wrap={false}>
                <Text style={s.ipTitle}>{ws.url}</Text>
                <Text style={s.ipMeta}>Status: {ws.status_code} | Server: {ws.server || 'N/A'}</Text>
                {ws.title && <Text style={s.ipMeta}>Título: {ws.title}</Text>}
                {ws.technologies?.length > 0 && (
                  <Text style={s.ipMeta}>Tech: {ws.technologies.join(', ')}</Text>
                )}
              </View>
            ))}
          </View>
          <PDFFooter />
        </Page>
      )}
    </Document>
  );
};
