import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius } from '../styles/pdfStyles';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginBottom: spacing.sectionGap,
  },
  card: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 80,
  },
  cardWithAccent: {
    borderLeftWidth: 3,
  },
  value: {
    fontSize: 20,
    fontFamily: typography.bold,
    marginBottom: 2,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 12,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
});

export interface StatItem {
  label: string;
  value: number | string;
  color?: string;
  icon?: string;
}

interface PDFStatsRowProps {
  stats: StatItem[];
}

const defaultStats: StatItem[] = [
  { label: 'Total', value: 0, color: colors.info, icon: '∑' },
  { label: 'Aprovadas', value: 0, color: colors.success, icon: '✓' },
  { label: 'Falhas', value: 0, color: colors.danger, icon: '✗' },
  { label: 'Alertas', value: 0, color: colors.warning, icon: '!' },
];

export const PDFStatsRow: React.FC<PDFStatsRowProps> = ({ stats = defaultStats }) => {
  return (
    <View style={styles.container}>
      {stats.map((stat, index) => {
        const accentColor = stat.color || colors.textMuted;
        
        return (
          <View
            key={index}
            style={[
              styles.card,
              styles.cardWithAccent,
              { borderLeftColor: accentColor },
            ]}
          >
            {/* Icon Circle */}
            <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
              <Text style={styles.iconText}>{stat.icon || '•'}</Text>
            </View>
            
            {/* Value */}
            <Text style={[styles.value, { color: accentColor }]}>
              {stat.value}
            </Text>
            
            {/* Label */}
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

// Convenience wrapper for common compliance stats
interface ComplianceStatsProps {
  total: number;
  passed: number;
  failed: number;
  warnings?: number;
}

export const PDFComplianceStats: React.FC<ComplianceStatsProps> = ({
  total,
  passed,
  failed,
  warnings = 0,
}) => {
  const stats: StatItem[] = [
    { label: 'Total', value: total, color: colors.info, icon: '∑' },
    { label: 'Aprovadas', value: passed, color: colors.success, icon: '✓' },
    { label: 'Falhas', value: failed, color: colors.danger, icon: '✗' },
  ];
  
  if (warnings > 0) {
    stats.push({ label: 'Alertas', value: warnings, color: colors.warning, icon: '!' });
  }
  
  return <PDFStatsRow stats={stats} />;
};
