import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing, radius, getSeverityColors } from '../styles/pdfStyles';
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  headerTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
  headerRate: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
  },
  checksList: {
    paddingLeft: spacing.cardPadding,
  },
  checkItem: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    marginBottom: spacing.tight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkItemFailed: {
    borderColor: colors.danger,
    borderLeftWidth: 3,
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
  },
  recommendation: {
    fontSize: typography.bodySmall,
    color: colors.warning,
    fontFamily: typography.italic,
    marginTop: spacing.tight,
    paddingTop: spacing.tight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recommendationLabel: {
    fontFamily: typography.bold,
    color: colors.warningLight,
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
  icon,
  color = colors.primary,
  showPassedChecks = true,
}) => {
  const passedCount = checks.filter((c) => c.status === 'pass').length;
  const totalCount = checks.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  
  // Determine header color based on pass rate
  const rateColor = passRate >= 80 
    ? colors.success 
    : passRate >= 50 
      ? colors.warning 
      : colors.danger;

  // Filter checks to display
  const displayChecks = showPassedChecks 
    ? checks 
    : checks.filter((c) => c.status !== 'pass');

  return (
    <View style={styles.container} wrap={false}>
      {/* Category Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && (
            <View style={[styles.categoryIcon, { backgroundColor: color }]}>
              <Text style={styles.categoryIconText}>{icon}</Text>
            </View>
          )}
          <Text style={styles.headerTitle}>{name}</Text>
        </View>
        <Text style={[styles.headerRate, { color: rateColor }]}>
          {passedCount}/{totalCount} ({passRate}%)
        </Text>
      </View>

      {/* Checks List */}
      <View style={styles.checksList}>
        {displayChecks.map((check, index) => {
          const isFailed = check.status === 'fail';
          
          return (
            <View 
              key={index} 
              style={[
                styles.checkItem,
                isFailed && styles.checkItemFailed,
              ]}
              wrap={false}
            >
              {/* Check Header */}
              <View style={styles.checkHeader}>
                <PDFStatusIcon status={check.status} size={14} />
                <Text style={styles.checkName}>{check.name}</Text>
                {check.severity && (
                  <PDFBadge severity={check.severity} />
                )}
              </View>

              {/* Description */}
              {check.description && (
                <Text style={styles.checkDescription}>
                  {check.description}
                </Text>
              )}

              {/* Recommendation (only for failed checks) */}
              {isFailed && check.recommendation && (
                <Text style={styles.recommendation}>
                  <Text style={styles.recommendationLabel}>Recomendação: </Text>
                  {check.recommendation}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};
