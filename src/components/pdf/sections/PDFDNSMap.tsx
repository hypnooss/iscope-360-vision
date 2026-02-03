/**
 * PDFDNSMap - DNS Infrastructure Map for PDF reports
 * Layout: Full-width cards with colored headers (matching category sections)
 * Version: 3.0.0 - Redesigned to match "Detalhamento por Categoria" style
 */
import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  colors,
  typography,
  spacing,
  radius,
} from '../styles/pdfStyles';

// ─────────────────────────────────────────────────────────────────────────────
// Types
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
// Colors - Header backgrounds (solid colors matching web DNS Map)
// ─────────────────────────────────────────────────────────────────────────────

const headerColors = {
  ns: '#0EA5E9',      // Sky
  soa: '#F59E0B',     // Amber
  mx: '#A855F7',      // Violet
  txt: '#EC4899',     // Pink
  subdomain: '#6366F1', // Indigo
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Page title (matches "Detalhamento por Categoria")
  pageTitle: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.sectionGap,
  },
  // Card container
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  // Card header (solid color background, white text)
  cardHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardHeaderText: {
    fontSize: typography.body,
    fontFamily: typography.bold,
    color: '#FFFFFF',
  },
  // Card body
  cardBody: {
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  // Info item (● icon + text, like SPF Válido)
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  infoItemLast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 3,
    marginRight: 10,
  },
  statusDotActive: {
    backgroundColor: colors.success,
  },
  statusDotInactive: {
    backgroundColor: colors.textMuted,
  },
  infoText: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  infoTextMono: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Courier',
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginRight: 6,
  },
  // Subdomain grid (2 columns)
  subdomainGrid: {
    flexDirection: 'row',
  },
  subdomainColumn: {
    flex: 1,
  },
  // Empty state
  emptyText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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

interface InfoItemProps {
  text: string;
  isActive?: boolean;
  isLast?: boolean;
  mono?: boolean;
}

function InfoItem({ text, isActive = true, isLast = false, mono = true }: InfoItemProps) {
  return (
    <View style={isLast ? styles.infoItemLast : styles.infoItem}>
      <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
      <Text style={mono ? styles.infoTextMono : styles.infoText}>{text}</Text>
    </View>
  );
}

interface InfoItemWithLabelProps {
  label: string;
  value: string;
  isActive?: boolean;
  isLast?: boolean;
}

function InfoItemWithLabel({ label, value, isActive = true, isLast = false }: InfoItemWithLabelProps) {
  return (
    <View style={isLast ? styles.infoItemLast : styles.infoItem}>
      <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoTextMono}>{value}</Text>
    </View>
  );
}

interface DNSCardProps {
  title: string;
  color: string;
  children: React.ReactNode;
}

function DNSCard({ title, color, children }: DNSCardProps) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={[styles.cardHeader, { backgroundColor: color }]}>
        <Text style={styles.cardHeaderText}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
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

  // Filter only active subdomains
  const allSubdomains = subdomainSummary?.subdomains || [];
  const activeSubdomains = allSubdomains.filter(sub => sub.is_alive === true);

  // Split into 2 columns
  const halfSubs = Math.ceil(activeSubdomains.length / 2);
  const subCol1 = activeSubdomains.slice(0, halfSubs);
  const subCol2 = activeSubdomains.slice(halfSubs);

  return (
    <View>
      {/* Page Title (teal, like "Detalhamento por Categoria") */}
      <Text style={styles.pageTitle}>Mapa de Infraestrutura DNS</Text>

      {/* NS Card */}
      <DNSCard title="NS" color={headerColors.ns}>
        {nsRecords.length > 0 ? (
          nsRecords.map((ns, idx) => (
            <InfoItem 
              key={idx} 
              text={ns.host} 
              isLast={idx === nsRecords.length - 1}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum NS encontrado</Text>
        )}
      </DNSCard>

      {/* SOA Card */}
      <DNSCard title="SOA" color={headerColors.soa}>
        <InfoItemWithLabel 
          label="Primary" 
          value={dnsSummary?.soaMname ? truncate(dnsSummary.soaMname, 50) : 'N/A'} 
        />
        <InfoItemWithLabel 
          label="Contact" 
          value={dnsSummary?.soaContact ? truncate(dnsSummary.soaContact, 50) : 'N/A'} 
        />
        <InfoItemWithLabel 
          label="DNSSEC" 
          value={dnssecActive ? 'Ativo' : 'Inativo'} 
          isActive={dnssecActive}
          isLast
        />
      </DNSCard>

      {/* MX Card */}
      <DNSCard title="MX" color={headerColors.mx}>
        {mxRecords.length > 0 ? (
          mxRecords.map((mx, idx) => (
            <InfoItem 
              key={idx} 
              text={`${mx.exchange} (Pri: ${mx.priority})`}
              isLast={idx === mxRecords.length - 1}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum MX encontrado</Text>
        )}
      </DNSCard>

      {/* TXT (Email Auth) Card */}
      <DNSCard title="TXT (Email Auth)" color={headerColors.txt}>
        {/* SPF */}
        <InfoItemWithLabel 
          label="SPF" 
          value={spfRecord ? truncate(spfRecord, 70) : 'Não encontrado'} 
          isActive={emailAuth?.spf}
        />
        
        {/* DKIM */}
        {dkimKeys.length > 0 ? (
          dkimKeys.map((key, idx) => (
            <InfoItemWithLabel 
              key={idx}
              label="DKIM" 
              value={`${key.selector}${key.keySize ? ` - ${key.keySize} bits` : ''}`}
              isActive={emailAuth?.dkim}
            />
          ))
        ) : (
          <InfoItemWithLabel 
            label="DKIM" 
            value="Nenhum seletor" 
            isActive={false}
          />
        )}
        
        {/* DMARC */}
        <InfoItemWithLabel 
          label="DMARC" 
          value={
            dmarcPolicy.p || dmarcPolicy.sp 
              ? `p=${dmarcPolicy.p || 'none'}${dmarcPolicy.sp ? `, sp=${dmarcPolicy.sp}` : ''}`
              : 'Não encontrado'
          }
          isActive={emailAuth?.dmarc}
          isLast
        />
      </DNSCard>

      {/* Subdomínios Card (only active) */}
      <DNSCard title="Subdomínios" color={headerColors.subdomain}>
        {activeSubdomains.length > 0 ? (
          <View style={styles.subdomainGrid}>
            <View style={styles.subdomainColumn}>
              {subCol1.map((sub, idx) => (
                <InfoItem 
                  key={idx} 
                  text={truncate(sub.subdomain, 40)}
                  isLast={idx === subCol1.length - 1 && subCol2.length === 0}
                />
              ))}
            </View>
            <View style={styles.subdomainColumn}>
              {subCol2.map((sub, idx) => (
                <InfoItem 
                  key={idx} 
                  text={truncate(sub.subdomain, 40)}
                  isLast={idx === subCol2.length - 1}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>Nenhum subdomínio ativo encontrado</Text>
        )}
      </DNSCard>
    </View>
  );
}
