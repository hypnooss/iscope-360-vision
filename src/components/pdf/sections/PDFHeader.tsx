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
    marginLeft: -(spacing.pageHorizontal + 1),
    marginRight: -(spacing.pageHorizontal + 1),
    marginTop: -spacing.page,
    paddingLeft: spacing.pageHorizontal + 1,
    paddingRight: spacing.pageHorizontal + 1,
    paddingVertical: spacing.sectionGap,
    marginBottom: spacing.sectionGap,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    minHeight: 60,
  },
  logoContainer: {
    position: 'absolute',
    right: 0,
  },
  logo: {
    width: 60,
    height: 60,
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
    marginTop: 0,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  reportType: {
    fontSize: typography.subheading,
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
    fontSize: typography.body,
    color: textMuted,
    textAlign: 'right',
  },
  workspaceName: {
    fontSize: typography.body,
    color: textMuted,
    textAlign: 'right',
    marginTop: 6,
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
        {logoBase64 && (
          <View style={styles.logoContainer}>
            <Image style={styles.logo} src={logoBase64} />
          </View>
        )}
      </View>

      {/* Linha 2: Info + Metadata */}
      <View style={styles.infoRow}>
        <View style={styles.leftColumn}>
          <Text style={styles.reportType}>{reportType}</Text>
          <Text style={styles.target}>{target}</Text>
        </View>
        <View style={styles.rightColumn}>
          <Text style={styles.dateText}>Análise executada em: {date}</Text>
          {subtitle && <Text style={styles.workspaceName}>Workspace: {subtitle}</Text>}
        </View>
      </View>
    </View>
  );
};
