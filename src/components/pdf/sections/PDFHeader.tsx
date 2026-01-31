import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius } from '../styles/pdfStyles';

// Import logo as base64 for PDF compatibility
// Note: @react-pdf/renderer requires either URL or base64 for images
const logoPath = '/logo-iscope.png';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  brandText: {
    fontSize: 28,
    fontFamily: typography.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: typography.subheading,
    fontFamily: typography.regular,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  target: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  date: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginBottom: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerCenter: {
    width: 120,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    marginHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
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
  title: string;
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

      {/* Subtitle */}
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}

      {/* Report Type */}
      <Text style={styles.subtitle}>{reportType}</Text>

      {/* Target Name */}
      <Text style={styles.target}>{target}</Text>

      {/* Date */}
      <Text style={styles.date}>Gerado em {date}</Text>

      {/* Decorative Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <View style={styles.dividerCenter} />
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
};
