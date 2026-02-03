import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  radius,
} from '../styles/pdfStyles';

// ─────────────────────────────────────────────────────────────────────────────
// Types (PDF-specific - matches ExternalDomainPDF types)
// ─────────────────────────────────────────────────────────────────────────────

interface DnsSummary {
  ns?: string[];
  soaMname?: string | null;
  soaContact?: string | null;
  dnssecHasDnskey?: boolean;
  dnssecHasDs?: boolean;
  dnssecValidated?: boolean;
  dnssecNotes?: string[];
}

interface SubdomainEntry {
  subdomain: string;
  sources: string[];
  addresses: Array<{ ip: string; type?: string }>;
  is_alive?: boolean;
}

interface SubdomainSummary {
  total_found: number;
  subdomains: SubdomainEntry[];
  sources: string[];
  mode: string;
}

interface ComplianceCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending' | 'unknown';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  recommendation?: string;
  rawData?: Record<string, unknown>;
}

interface ComplianceCategory {
  name: string;
  passRate: number;
  checks: ComplianceCheck[];
}

interface NsRecord {
  host: string;
  resolvedIps: string[];
}

interface MxRecord {
  exchange: string;
  priority: number;
  ips: string[];
}

interface DkimKey {
  selector: string;
  keySize: number | null;
}

interface DmarcPolicy {
  p: string | null;
  sp: string | null;
}

interface PDFDNSMapProps {
  dnsSummary?: DnsSummary;
  emailAuth?: { spf: boolean; dkim: boolean; dmarc: boolean };
  subdomainSummary?: SubdomainSummary;
  categories: ComplianceCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

const groupColors = {
  ns: { border: '#0EA5E9', bg: '#F0F9FF', text: '#0369A1' },
  mx: { border: '#A855F7', bg: '#FAF5FF', text: '#7C3AED' },
  soa: { border: '#F59E0B', bg: '#FFFBEB', text: '#B45309' },
  txt: { border: '#EC4899', bg: '#FDF2F8', text: '#BE185D' },
  subdomain: { border: '#6366F1', bg: '#EEF2FF', text: '#4338CA' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles (FIXED: removed unsupported 'gap' property)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.cardBg,
  },
  header: {
    backgroundColor: '#1E293B',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerIconText: {
    fontSize: 12,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    padding: spacing.cardPadding,
  },
  column: {
    flex: 1,
    marginRight: 12,
  },
  columnLast: {
    flex: 1,
    marginRight: 0,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  groupTitle: {
    fontSize: typography.body,
    fontFamily: typography.bold,
    flex: 1,
    marginRight: 6,
  },
  groupCount: {
    fontSize: typography.tiny,
    fontFamily: typography.bold,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  groupContent: {
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  recordText: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Courier',
    flex: 1,
  },
  recordSublabel: {
    fontSize: typography.tiny,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: colors.primary,
  },
  statusDotInactive: {
    backgroundColor: colors.textMuted,
  },
  statusDotPass: {
    backgroundColor: colors.success,
  },
  statusDotFail: {
    backgroundColor: colors.danger,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    width: 55,
  },
  infoValue: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Courier',
    flex: 1,
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  authLabel: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    width: 45,
  },
  authValue: {
    fontSize: typography.tiny,
    color: colors.textSecondary,
    fontFamily: 'Courier',
    flex: 1,
  },
  moreText: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  subdomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  subdomainText: {
    fontSize: typography.tiny,
    color: colors.textPrimary,
    fontFamily: 'Courier',
    flex: 1,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (adapted from web version)
// ─────────────────────────────────────────────────────────────────────────────

const extractNsRecords = (categories: ComplianceCategory[]): NsRecord[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const nsCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'ns_records');
  const records = (nsCheck?.rawData as any)?.data?.records || [];
  
  return records.map((r: any) => ({
    host: r.host || r.name || r.value || 'Unknown',
    resolvedIps: Array.isArray(r.resolved_ips) ? r.resolved_ips : [],
  })).filter((ns: NsRecord) => ns.host && ns.host !== 'Unknown');
};

const extractMxRecords = (categories: ComplianceCategory[]): MxRecord[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const mxCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'mx_records');
  const records = (mxCheck?.rawData as any)?.data?.records || [];
  
  return records.map((r: any) => ({
    exchange: r.exchange || r.host || 'Unknown',
    priority: r.priority || 0,
    ips: r.resolved_ips || [],
  }));
};

const extractSpfRecord = (categories: ComplianceCategory[]): string | null => {
  const allChecks = categories.flatMap(c => c.checks);
  const spfCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'spf_record');
  return (spfCheck?.rawData as any)?.data?.raw || null;
};

const extractDkimKeys = (categories: ComplianceCategory[]): DkimKey[] => {
  const allChecks = categories.flatMap(c => c.checks);
  const dkimCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'dkim_records');
  const found = (dkimCheck?.rawData as any)?.data?.found || [];
  return found.map((f: any) => ({
    selector: f.selector,
    keySize: f.key_size_bits || null,
  })).filter((k: DkimKey) => k.selector);
};

const extractDmarcPolicy = (categories: ComplianceCategory[]): DmarcPolicy => {
  const allChecks = categories.flatMap(c => c.checks);
  const dmarcCheck = allChecks.find((ch: any) => ch.rawData?.step_id === 'dmarc_record');
  const parsed = (dmarcCheck?.rawData as any)?.data?.parsed || {};
  return {
    p: parsed.p || null,
    sp: parsed.sp || null,
  };
};

const truncate = (str: string, len: number): string => {
  if (str.length <= len) return str;
  return str.substring(0, len - 1) + '…';
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface GroupCardProps {
  title: string;
  count: number;
  colorKey: keyof typeof groupColors;
  children: React.ReactNode;
}

function GroupCard({ title, count, colorKey, children }: GroupCardProps) {
  const color = groupColors[colorKey];
  return (
    <View style={[styles.groupCard, { borderColor: color.border }]}>
      <View style={[styles.groupHeader, { backgroundColor: color.bg }]}>
        <Text style={[styles.groupTitle, { color: color.text }]}>{title}</Text>
        <Text style={[styles.groupCount, { color: color.text }]}>{count}</Text>
      </View>
      <View style={styles.groupContent}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function PDFDNSMap({ dnsSummary, emailAuth, subdomainSummary, categories }: PDFDNSMapProps) {
  // Extract data
  const nsRecordsFromRaw = extractNsRecords(categories);
  const nsRecordsFallback = (dnsSummary?.ns || []).map(host => ({ host, resolvedIps: [] as string[] }));
  const nsRecords = nsRecordsFromRaw.length > 0 ? nsRecordsFromRaw : nsRecordsFallback;
  
  const mxRecords = extractMxRecords(categories);
  const spfRecord = extractSpfRecord(categories);
  const dkimKeys = extractDkimKeys(categories);
  const dmarcPolicy = extractDmarcPolicy(categories);
  
  const dnssecActive = dnsSummary?.dnssecHasDnskey || dnsSummary?.dnssecHasDs;

  // Limits
  const MAX_NS = 6;
  const MAX_MX = 4;
  const MAX_DKIM = 3;
  const MAX_SUBDOMAINS = 15;

  const visibleNs = nsRecords.slice(0, MAX_NS);
  const moreNs = nsRecords.length > MAX_NS ? nsRecords.length - MAX_NS : 0;

  const visibleMx = mxRecords.slice(0, MAX_MX);
  const moreMx = mxRecords.length > MAX_MX ? mxRecords.length - MAX_MX : 0;

  const visibleDkim = dkimKeys.slice(0, MAX_DKIM);
  const moreDkim = dkimKeys.length > MAX_DKIM ? dkimKeys.length - MAX_DKIM : 0;

  const subdomains = subdomainSummary?.subdomains || [];
  const visibleSubdomains = subdomains.slice(0, MAX_SUBDOMAINS);
  const moreSubdomains = subdomains.length > MAX_SUBDOMAINS ? subdomains.length - MAX_SUBDOMAINS : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>●</Text>
        </View>
        <Text style={styles.headerTitle}>Mapa de Infraestrutura DNS</Text>
      </View>

      {/* Grid: 3 Columns */}
      <View style={styles.grid}>
        {/* Column 1: NS + MX */}
        <View style={styles.column}>
          {/* NS Records */}
          <GroupCard title="NS" count={nsRecords.length} colorKey="ns">
            {visibleNs.length > 0 ? (
              <View>
                {visibleNs.map((ns, idx) => (
                  <View key={idx} style={styles.recordItem}>
                    <Text style={styles.recordText}>{truncate(ns.host, 28)}</Text>
                  </View>
                ))}
                {moreNs > 0 && (
                  <Text style={styles.moreText}>+{moreNs} nameservers</Text>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nenhum NS encontrado</Text>
            )}
          </GroupCard>

          {/* MX Records */}
          <GroupCard title="MX" count={mxRecords.length} colorKey="mx">
            {visibleMx.length > 0 ? (
              <View>
                {visibleMx.map((mx, idx) => (
                  <View key={idx} style={{ marginBottom: 4 }}>
                    <Text style={styles.recordText}>{truncate(mx.exchange, 28)}</Text>
                    <Text style={styles.recordSublabel}>Prioridade: {mx.priority}</Text>
                  </View>
                ))}
                {moreMx > 0 && (
                  <Text style={styles.moreText}>+{moreMx} mail servers</Text>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nenhum MX encontrado</Text>
            )}
          </GroupCard>
        </View>

        {/* Column 2: SOA + TXT */}
        <View style={styles.column}>
          {/* SOA / DNSSEC */}
          <GroupCard title="SOA" count={1} colorKey="soa">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Primary:</Text>
              <Text style={styles.infoValue}>
                {dnsSummary?.soaMname ? truncate(dnsSummary.soaMname, 22) : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact:</Text>
              <Text style={styles.infoValue}>
                {dnsSummary?.soaContact ? truncate(dnsSummary.soaContact, 22) : 'N/A'}
              </Text>
            </View>
            <View style={[styles.authRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.statusDot, dnssecActive ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.infoLabel}>DNSSEC:</Text>
              <Text style={[styles.infoValue, { color: dnssecActive ? colors.primary : colors.textMuted }]}>
                {dnssecActive ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </GroupCard>

          {/* TXT (Email Auth) */}
          <GroupCard title="TXT" count={3} colorKey="txt">
            {/* SPF */}
            <View style={styles.authRow}>
              <View style={[styles.statusDot, emailAuth?.spf ? styles.statusDotPass : styles.statusDotFail]} />
              <Text style={styles.authLabel}>SPF</Text>
            </View>
            {spfRecord ? (
              <Text style={[styles.authValue, { marginLeft: 9, marginBottom: 6 }]}>
                {truncate(spfRecord, 35)}
              </Text>
            ) : (
              <Text style={[styles.authValue, { marginLeft: 9, marginBottom: 6, fontStyle: 'italic' }]}>
                Não encontrado
              </Text>
            )}

            {/* DKIM */}
            <View style={styles.authRow}>
              <View style={[styles.statusDot, emailAuth?.dkim ? styles.statusDotPass : styles.statusDotFail]} />
              <Text style={styles.authLabel}>DKIM</Text>
            </View>
            {visibleDkim.length > 0 ? (
              <View>
                {visibleDkim.map((key, idx) => (
                  <Text key={idx} style={[styles.authValue, { marginLeft: 9 }]}>
                    {key.selector}{key.keySize ? ` - ${key.keySize} bits` : ''}
                  </Text>
                ))}
                {moreDkim > 0 && (
                  <Text style={[styles.moreText, { marginLeft: 9, marginBottom: 6 }]}>+{moreDkim} seletores</Text>
                )}
              </View>
            ) : (
              <Text style={[styles.authValue, { marginLeft: 9, marginBottom: 6, fontStyle: 'italic' }]}>
                Nenhum seletor
              </Text>
            )}

            {/* DMARC */}
            <View style={[styles.authRow, { marginTop: 4 }]}>
              <View style={[styles.statusDot, emailAuth?.dmarc ? styles.statusDotPass : styles.statusDotFail]} />
              <Text style={styles.authLabel}>DMARC</Text>
            </View>
            {dmarcPolicy.p || dmarcPolicy.sp ? (
              <View>
                {dmarcPolicy.p && (
                  <Text style={[styles.authValue, { marginLeft: 9 }]}>
                    Política: {dmarcPolicy.p}
                  </Text>
                )}
                {dmarcPolicy.sp && (
                  <Text style={[styles.authValue, { marginLeft: 9 }]}>
                    Subdomínios: {dmarcPolicy.sp}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={[styles.authValue, { marginLeft: 9, fontStyle: 'italic' }]}>
                Não encontrado
              </Text>
            )}
          </GroupCard>
        </View>

        {/* Column 3: Subdomains */}
        <View style={styles.columnLast}>
          <GroupCard title="Subdomínios" count={subdomainSummary?.total_found ?? 0} colorKey="subdomain">
            {visibleSubdomains.length > 0 ? (
              <View>
                {visibleSubdomains.map((sub, idx) => (
                  <View key={idx} style={styles.subdomainRow}>
                    <View style={[
                      styles.statusDot, 
                      sub.is_alive ? styles.statusDotActive : styles.statusDotInactive
                    ]} />
                    <Text style={styles.subdomainText}>
                      {truncate(sub.subdomain, 26)}
                    </Text>
                  </View>
                ))}
                {moreSubdomains > 0 && (
                  <Text style={styles.moreText}>+{moreSubdomains} subdomínios</Text>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nenhum subdomínio encontrado</Text>
            )}
          </GroupCard>
        </View>
      </View>
    </View>
  );
}
