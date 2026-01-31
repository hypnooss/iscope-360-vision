import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius } from '../styles/pdfStyles';
import { PDFStatusIcon } from '../shared/PDFStatusIcon';
import { PDFDivider } from '../shared/PDFDivider';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    marginBottom: spacing.sectionGap,
  },
  title: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.primary,
    marginBottom: spacing.itemGap,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingVertical: spacing.tight,
    paddingRight: spacing.itemGap,
  },
  gridItemFull: {
    width: '100%',
    paddingVertical: spacing.tight,
  },
  label: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  value: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: typography.bold,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  listItem: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  section: {
    marginTop: spacing.itemGap,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontFamily: typography.bold,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
  },
});

interface DomainInfoData {
  soa?: string;
  nameservers?: string[];
  contactEmail?: string;
  dnssec?: boolean;
  spf?: {
    valid: boolean;
    record?: string;
  };
  dkim?: {
    valid: boolean;
    selectors?: string[];
  };
  dmarc?: {
    valid: boolean;
    policy?: string;
    record?: string;
  };
}

interface PDFDomainInfoProps {
  data: DomainInfoData;
}

export const PDFDomainInfo: React.FC<PDFDomainInfoProps> = ({ data }) => {
  const {
    soa,
    nameservers = [],
    contactEmail,
    dnssec,
    spf,
    dkim,
    dmarc,
  } = data;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Informações do Domínio</Text>
      
      {/* Basic Info Grid */}
      <View style={styles.grid}>
        {soa && (
          <View style={styles.gridItem}>
            <Text style={styles.label}>SOA (Autoridade)</Text>
            <Text style={styles.value}>{soa}</Text>
          </View>
        )}
        
        {contactEmail && (
          <View style={styles.gridItem}>
            <Text style={styles.label}>Contato</Text>
            <Text style={styles.value}>{contactEmail}</Text>
          </View>
        )}
        
        {dnssec !== undefined && (
          <View style={styles.gridItem}>
            <Text style={styles.label}>DNSSEC</Text>
            <View style={styles.statusRow}>
              <PDFStatusIcon status={dnssec ? 'pass' : 'fail'} size={12} />
              <Text style={styles.statusLabel}>
                {dnssec ? 'Habilitado' : 'Desabilitado'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Nameservers */}
      {nameservers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nameservers</Text>
          {nameservers.map((ns, index) => (
            <Text key={index} style={styles.listItem}>
              • {ns}
            </Text>
          ))}
        </View>
      )}

      <PDFDivider style={{ marginVertical: spacing.itemGap }} />

      {/* Email Authentication */}
      <Text style={styles.sectionTitle}>Autenticação de Email</Text>
      <View style={styles.grid}>
        {/* SPF */}
        <View style={styles.gridItem}>
          <Text style={styles.label}>SPF</Text>
          <View style={styles.statusRow}>
            <PDFStatusIcon status={spf?.valid ? 'pass' : 'fail'} size={12} />
            <Text style={styles.statusLabel}>
              {spf?.valid ? 'Válido' : 'Inválido ou Ausente'}
            </Text>
          </View>
        </View>

        {/* DKIM */}
        <View style={styles.gridItem}>
          <Text style={styles.label}>DKIM</Text>
          <View style={styles.statusRow}>
            <PDFStatusIcon status={dkim?.valid ? 'pass' : 'fail'} size={12} />
            <Text style={styles.statusLabel}>
              {dkim?.valid ? 'Configurado' : 'Não Encontrado'}
            </Text>
          </View>
        </View>

        {/* DMARC */}
        <View style={styles.gridItem}>
          <Text style={styles.label}>DMARC</Text>
          <View style={styles.statusRow}>
            <PDFStatusIcon status={dmarc?.valid ? 'pass' : 'fail'} size={12} />
            <Text style={styles.statusLabel}>
              {dmarc?.valid 
                ? `Política: ${dmarc.policy || 'none'}` 
                : 'Não Configurado'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
