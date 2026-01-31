import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius, getScoreColor } from '../styles/pdfStyles';
import { PDFStatusIcon } from '../shared/PDFStatusIcon';
import { PDFBadge } from '../shared/PDFBadge';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sectionGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    marginBottom: spacing.itemGap,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRate: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
  },
  headerCount: {
    fontSize: typography.bodySmall,
    color: colors.textMuted,
  },
  checksList: {
    paddingLeft: 8,
  },
  // Compact check row for passed checks
  checkRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.itemGap,
    gap: 8,
  },
  checkNameCompact: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  // Expanded check item for failed checks
  checkItemExpanded: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    marginBottom: spacing.itemGap,
    borderWidth: 1,
    borderColor: colors.borderDanger,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.tight,
  },
  checkName: {
    fontSize: typography.body,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  checkDescription: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 1.4,
    marginBottom: spacing.tight,
    marginLeft: 22,
  },
  recommendation: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginLeft: 22,
    marginTop: spacing.tight,
    paddingTop: spacing.tight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recommendationLabel: {
    fontFamily: typography.bold,
    color: colors.warning,
  },
  passedSection: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.itemGap,
    marginTop: spacing.itemGap,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 3,
  },
  passedTitle: {
    fontSize: typography.bodySmall,
    fontFamily: typography.bold,
    color: colors.success,
    marginBottom: spacing.tight,
  },
  passedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  passedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: colors.pageBg,
    borderRadius: radius.sm,
  },
  passedItemText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
});

export interface Check {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description?: string;
  recommendation?: string;
}

interface PDFCategorySectionProps {
  name: string;
  checks: Check[];
  icon?: string;
  color?: string;
  showPassedChecks?: boolean;
}

export const PDFCategorySection: React.FC<PDFCategorySectionProps> = ({
  name,
  checks,
  color = colors.primary,
  showPassedChecks = true,
}) => {
  const passedChecks = checks.filter((c) => c.status === 'pass');
  const failedChecks = checks.filter((c) => c.status === 'fail' || c.status === 'warning');
  const passedCount = passedChecks.length;
  const totalCount = checks.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  
  const rateColor = getScoreColor(passRate);

  return (
    <View style={styles.container} wrap={false}>
      {/* Category Header */}
      <View style={[styles.header, { borderLeftColor: color }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{name}</Text>
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.headerCount}>
            {passedCount}/{totalCount}
          </Text>
          <Text style={[styles.headerRate, { color: rateColor }]}>
            {passRate}%
          </Text>
        </View>
      </View>

      {/* Failed Checks (expanded with details) */}
      <View style={styles.checksList}>
        {failedChecks.map((check, index) => (
          <View key={index} style={styles.checkItemExpanded} wrap={false}>
            <View style={styles.checkHeader}>
              <PDFStatusIcon status={check.status} size={14} />
              <Text style={styles.checkName}>{check.name}</Text>
              {check.severity && <PDFBadge severity={check.severity} />}
            </View>

            {check.description && (
              <Text style={styles.checkDescription}>
                {check.description}
              </Text>
            )}

            {check.recommendation && (
              <Text style={styles.recommendation}>
                <Text style={styles.recommendationLabel}>Recomendação: </Text>
                {check.recommendation}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Passed Checks (compact list) */}
      {showPassedChecks && passedChecks.length > 0 && (
        <View style={styles.passedSection}>
          <Text style={styles.passedTitle}>
            Verificações Aprovadas ({passedChecks.length})
          </Text>
          <View style={styles.passedList}>
            {passedChecks.map((check, index) => (
              <View key={index} style={styles.passedItem}>
                <PDFStatusIcon status="pass" size={8} />
                <Text style={styles.passedItemText}>{check.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
