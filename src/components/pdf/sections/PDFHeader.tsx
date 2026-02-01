import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from '../styles/pdfStyles';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sectionGap,
    paddingBottom: spacing.sectionGap,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandText: {
    fontSize: 24,
    fontFamily: typography.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'right',
  },
  infoSection: {
    marginTop: 8,
    paddingLeft: 52, // Align with text after logo
  },
  reportType: {
    fontSize: typography.body,
    fontFamily: typography.regular,
    color: colors.textMuted,
    marginBottom: 4,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  target: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
  separator: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  clientName: {
    fontSize: typography.body,
    color: colors.textSecondary,
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
  reportType = 'Análise de Domínio Externo',
  logoBase64,
}) => {
  return (
    <View style={styles.container}>
      {/* Top Row: Brand + Date */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          {logoBase64 && (
            <Image style={styles.logo} src={logoBase64} />
          )}
          <Text style={styles.brandText}>{title}</Text>
        </View>
        <Text style={styles.dateText}>{date}</Text>
      </View>

      {/* Info Section: Report Type + Target */}
      <View style={styles.infoSection}>
        <Text style={styles.reportType}>{reportType}</Text>
        <View style={styles.targetRow}>
          <Text style={styles.target}>{target}</Text>
          {subtitle && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.clientName}>Cliente: {subtitle}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};
