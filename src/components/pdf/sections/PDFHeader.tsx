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
    marginLeft: -spacing.pageHorizontal,
    marginRight: -spacing.pageHorizontal,
    marginTop: -spacing.page,
    paddingLeft: spacing.pageHorizontal,
    paddingRight: spacing.pageHorizontal,
    paddingVertical: spacing.sectionGap,
    marginBottom: spacing.sectionGap,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  brandText: {
    fontSize: 22,
    fontFamily: typography.bold,
    color: accentTeal,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  reportType: {
    fontSize: typography.body,
    fontFamily: typography.regular,
    color: textMuted,
    marginBottom: 4,
  },
  target: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: textWhite,
  },
  dateText: {
    fontSize: typography.bodySmall,
    color: textMuted,
    textAlign: 'right',
  },
  workspaceName: {
    fontSize: typography.bodySmall,
    color: textMuted,
    textAlign: 'right',
    marginTop: 2,
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
      {/* Linha 1: Título + Logo */}
      <View style={styles.topRow}>
        <Text style={styles.brandText}>{title}</Text>
        {logoBase64 && <Image style={styles.logo} src={logoBase64} />}
      </View>

      {/* Linha 2: Info + Metadata */}
      <View style={styles.infoRow}>
        <View style={styles.leftColumn}>
          <Text style={styles.reportType}>{reportType}</Text>
          <Text style={styles.target}>{target}</Text>
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.dateText}>{date}</Text>
          {subtitle && <Text style={styles.workspaceName}>Workspace: {subtitle}</Text>}
        </View>
      </View>
    </View>
  );
};
