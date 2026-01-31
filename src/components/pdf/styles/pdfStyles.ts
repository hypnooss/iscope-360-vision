import { StyleSheet } from '@react-pdf/renderer';

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE - Based on project design system
// ═══════════════════════════════════════════════════════════════

export const colors = {
  // Backgrounds
  pageBg: '#0F172A',        // slate-900
  cardBg: '#1E293B',        // slate-800
  cardBgLight: '#334155',   // slate-700
  cardBgSubtle: '#1E293B',  // slate-800 with transparency effect
  
  // Primary (Teal - matches project primary)
  primary: '#14B8A6',       // teal-500
  primaryLight: '#5EEAD4',  // teal-300
  primaryDark: '#0D9488',   // teal-600
  primaryMuted: '#134E4A',  // teal-900
  
  // Text
  textPrimary: '#F8FAFC',   // slate-50
  textSecondary: '#CBD5E1', // slate-300
  textMuted: '#94A3B8',     // slate-400
  textDark: '#64748B',      // slate-500
  
  // Status Colors
  success: '#22C55E',       // green-500
  successLight: '#86EFAC',  // green-300
  successBg: '#14532D',     // green-900
  
  warning: '#F59E0B',       // amber-500
  warningLight: '#FCD34D',  // amber-300
  warningBg: '#78350F',     // amber-900
  
  danger: '#EF4444',        // red-500
  dangerLight: '#FCA5A5',   // red-300
  dangerBg: '#7F1D1D',      // red-900
  
  info: '#3B82F6',          // blue-500
  infoLight: '#93C5FD',     // blue-300
  infoBg: '#1E3A8A',        // blue-900
  
  // Severity Colors (warm spectrum for issues)
  critical: '#DC2626',      // red-600
  criticalBg: '#450A0A',    // red-950
  high: '#EA580C',          // orange-600
  highBg: '#431407',        // orange-950
  medium: '#CA8A04',        // yellow-600
  mediumBg: '#422006',      // yellow-950
  low: '#0284C7',           // sky-600
  lowBg: '#082F49',         // sky-950
  
  // Category Colors (cool spectrum)
  categoryDns: '#0891B2',      // cyan-600
  categoryEmail: '#8B5CF6',    // violet-500
  categorySpf: '#059669',      // emerald-600
  categoryDkim: '#EC4899',     // pink-500
  categoryDmarc: '#F59E0B',    // amber-500
  categoryFirewall: '#6366F1', // indigo-500
  
  // Borders
  border: '#334155',        // slate-700
  borderLight: '#475569',   // slate-600
  borderPrimary: '#0D9488', // teal-600
  
  // Gradients (start/end for manual gradients in SVG)
  gradientStart: '#14B8A6', // teal-500
  gradientEnd: '#06B6D4',   // cyan-500
};

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════

export const typography = {
  // Font sizes
  title: 24,
  heading: 16,
  subheading: 14,
  body: 10,
  bodySmall: 9,
  caption: 8,
  tiny: 7,
  
  // Font weights (Helvetica variants)
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
};

// ═══════════════════════════════════════════════════════════════
// SPACING
// ═══════════════════════════════════════════════════════════════

export const spacing = {
  page: 30,           // Page margins
  sectionGap: 16,     // Gap between major sections
  cardPadding: 12,    // Internal card padding
  cardGap: 10,        // Gap between cards
  itemGap: 8,         // Gap between list items
  inlineGap: 6,       // Gap between inline elements
  tight: 4,           // Tight spacing
};

// ═══════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════

export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  full: 9999,
};

// ═══════════════════════════════════════════════════════════════
// SHADOWS (as border effects since PDF doesn't support box-shadow)
// ═══════════════════════════════════════════════════════════════

export const shadows = {
  card: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPrimary: {
    borderWidth: 1,
    borderColor: colors.borderPrimary,
  },
  cardDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
};

// ═══════════════════════════════════════════════════════════════
// SEVERITY HELPERS
// ═══════════════════════════════════════════════════════════════

export const getSeverityColors = (severity: string) => {
  switch (severity) {
    case 'critical':
      return { bg: colors.criticalBg, text: colors.critical, border: colors.critical };
    case 'high':
      return { bg: colors.highBg, text: colors.high, border: colors.high };
    case 'medium':
      return { bg: colors.mediumBg, text: colors.medium, border: colors.medium };
    case 'low':
      return { bg: colors.lowBg, text: colors.low, border: colors.low };
    default:
      return { bg: colors.cardBg, text: colors.textMuted, border: colors.border };
  }
};

export const getStatusColors = (status: string) => {
  switch (status) {
    case 'pass':
      return { bg: colors.successBg, text: colors.success, icon: '✓' };
    case 'fail':
      return { bg: colors.dangerBg, text: colors.danger, icon: '✗' };
    case 'warning':
      return { bg: colors.warningBg, text: colors.warning, icon: '!' };
    case 'pending':
      return { bg: colors.infoBg, text: colors.info, icon: '?' };
    default:
      return { bg: colors.cardBg, text: colors.textMuted, icon: '-' };
  }
};

export const getScoreColor = (score: number) => {
  if (score >= 75) return colors.primary;      // Green-teal for good
  if (score >= 50) return colors.warning;      // Amber for medium
  return colors.danger;                         // Red for poor
};

// ═══════════════════════════════════════════════════════════════
// BASE STYLES
// ═══════════════════════════════════════════════════════════════

export const baseStyles = StyleSheet.create({
  // Page
  page: {
    backgroundColor: colors.pageBg,
    padding: spacing.page,
    fontFamily: typography.regular,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  
  // Layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    flexDirection: 'column',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Cards
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPrimary: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
  },
  
  // Typography
  title: {
    fontSize: typography.title,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.tight,
  },
  heading: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.tight,
  },
  subheading: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.textSecondary,
  },
  body: {
    fontSize: typography.body,
    fontFamily: typography.regular,
    color: colors.textSecondary,
    lineHeight: 1.4,
  },
  caption: {
    fontSize: typography.caption,
    fontFamily: typography.regular,
    color: colors.textMuted,
  },
  
  // Utilities
  textPrimary: {
    color: colors.primary,
  },
  textMuted: {
    color: colors.textMuted,
  },
  textSuccess: {
    color: colors.success,
  },
  textDanger: {
    color: colors.danger,
  },
  textWarning: {
    color: colors.warning,
  },
  bold: {
    fontFamily: typography.bold,
  },
  
  // Spacing utilities
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
});

// ═══════════════════════════════════════════════════════════════
// COMPONENT-SPECIFIC STYLES
// ═══════════════════════════════════════════════════════════════

export const headerStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.sectionGap,
    alignItems: 'center',
  },
  brandText: {
    fontSize: 28,
    fontFamily: typography.bold,
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.subheading,
    fontFamily: typography.regular,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  date: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  divider: {
    width: 120,
    height: 2,
    backgroundColor: colors.primary,
    marginTop: 8,
    borderRadius: radius.full,
  },
});

export const scoreStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.cardPadding,
  },
  value: {
    fontSize: 48,
    fontFamily: typography.bold,
  },
  label: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export const statsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.cardGap,
  },
  card: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: typography.heading,
    fontFamily: typography.bold,
    marginBottom: 2,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});

export const issuesStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: spacing.sectionGap,
  },
  header: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.danger,
    marginBottom: spacing.itemGap,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.tight,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginRight: 6,
    marginTop: 3,
  },
  itemText: {
    fontSize: typography.bodySmall,
    color: colors.dangerLight,
    flex: 1,
  },
});

export const categoryStyles = StyleSheet.create({
  container: {
    marginTop: spacing.sectionGap,
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
  headerTitle: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
    color: colors.textPrimary,
  },
  headerRate: {
    fontSize: typography.subheading,
    fontFamily: typography.bold,
  },
  checkItem: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    marginBottom: spacing.tight,
    marginLeft: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
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
  },
  checkDescription: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
    lineHeight: 1.4,
  },
  recommendation: {
    fontSize: typography.bodySmall,
    color: colors.warning,
    fontFamily: typography.italic,
    marginTop: spacing.tight,
  },
});

export const footerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.page,
    left: spacing.page,
    right: spacing.page,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.itemGap,
  },
  brand: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  pageNumber: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});

export const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.tight,
  },
  text: {
    fontSize: typography.tiny,
    fontFamily: typography.bold,
    textTransform: 'uppercase',
  },
});

export const infoStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.borderPrimary,
    marginTop: spacing.sectionGap,
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
  valueSuccess: {
    fontSize: typography.bodySmall,
    color: colors.success,
    fontFamily: typography.bold,
  },
  valueDanger: {
    fontSize: typography.bodySmall,
    color: colors.danger,
    fontFamily: typography.bold,
  },
  listItem: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 2,
  },
});
