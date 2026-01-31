import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, radius, typography, getSeverityColors } from '../styles/pdfStyles';

interface PDFBadgeProps {
  label: string;
  variant?: 'severity' | 'status' | 'custom';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'pass' | 'fail' | 'warning' | 'pending';
  bgColor?: string;
  textColor?: string;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.tiny,
    fontFamily: typography.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export function PDFBadge({ 
  label, 
  variant = 'custom', 
  severity,
  status,
  bgColor,
  textColor,
}: PDFBadgeProps) {
  let bg = bgColor || colors.cardBgLight;
  let text = textColor || colors.textMuted;

  if (variant === 'severity' && severity) {
    const severityColors = getSeverityColors(severity);
    bg = severityColors.bg;
    text = severityColors.text;
  }

  if (variant === 'status' && status) {
    switch (status) {
      case 'pass':
        bg = colors.successBg;
        text = colors.success;
        break;
      case 'fail':
        bg = colors.dangerBg;
        text = colors.danger;
        break;
      case 'warning':
        bg = colors.warningBg;
        text = colors.warning;
        break;
      case 'pending':
        bg = colors.infoBg;
        text = colors.info;
        break;
    }
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}
