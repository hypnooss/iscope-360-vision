import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius } from '../styles/pdfStyles';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
    paddingBottom: spacing.sectionGap,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  brandText: {
    fontSize: typography.title,
    fontFamily: typography.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
  reportType: {
    fontSize: typography.body,
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  target: {
    fontSize: 18,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginRight: 4,
  },
  metaValue: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontFamily: typography.bold,
  },
});

interface PDFHeaderProps {
  title?: string;
  subtitle?: string;
  target: string;
  date: string;
  reportType?: string;
  logoBase64?: string;
}

export const PDFHeader: React.FC<PDFHeaderProps> = ({
  title = 'iScope 360',
  subtitle,
  target,
  date,
  reportType = 'Relatório de Análise',
  logoBase64,
}) => {
  return (
    <View style={styles.container}>
      {/* Brand Row */}
      <View style={styles.logoContainer}>
        {logoBase64 && (
          <Image style={styles.logo} src={logoBase64} />
        )}
        <Text style={styles.brandText}>{title.toUpperCase()}</Text>
      </View>

      {/* Report Type */}
      <Text style={styles.reportType}>{reportType}</Text>

      {/* Target Name */}
      <Text style={styles.target}>{target}</Text>

      {/* Metadata Row */}
      <View style={styles.metaRow}>
        {subtitle && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Cliente:</Text>
            <Text style={styles.metaValue}>{subtitle}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Gerado em:</Text>
          <Text style={styles.metaValue}>{date}</Text>
        </View>
      </View>
    </View>
  );
};
