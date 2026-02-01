import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { typography, spacing } from '../styles/pdfStyles';

// Dark blue header background (matching system background)
const headerBg = '#0F172A'; // slate-900 (dark blue)
const textWhite = '#FFFFFF';
const textMuted = '#94A3B8'; // slate-400
const accentTeal = '#14B8A6'; // teal-500

const styles = StyleSheet.create({
  container: {
    backgroundColor: headerBg,
    marginHorizontal: -spacing.pageHorizontal,
    marginTop: -spacing.page,
    paddingHorizontal: spacing.pageHorizontal,
    paddingVertical: spacing.sectionGap,
    marginBottom: spacing.sectionGap,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    objectFit: 'contain',
  },
  brandText: {
    fontSize: 22,
    fontFamily: typography.bold,
    color: accentTeal,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: typography.bodySmall,
    color: textMuted,
    textAlign: 'right',
  },
  infoSection: {
    marginTop: 4,
    paddingLeft: 42, // Align with text after logo
  },
  reportType: {
    fontSize: typography.body,
    fontFamily: typography.regular,
    color: textMuted,
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
    color: textWhite,
  },
  separator: {
    fontSize: typography.body,
    color: textMuted,
  },
  workspaceName: {
    fontSize: typography.body,
    color: textMuted,
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
              <Text style={styles.workspaceName}>Workspace: {subtitle}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};
