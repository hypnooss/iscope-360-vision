import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, radius, typography } from '../styles/pdfStyles';

interface PDFStatusIconProps {
  status: 'pass' | 'fail' | 'warning' | 'pending';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { container: 12, icon: 8 },
  md: { container: 16, icon: 10 },
  lg: { container: 20, icon: 12 },
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  icon: {
    fontFamily: typography.bold,
    textAlign: 'center',
  },
});

export function PDFStatusIcon({ status, size = 'md' }: PDFStatusIconProps) {
  const dimensions = sizeMap[size];
  
  let bgColor: string;
  let textColor: string;
  let icon: string;

  switch (status) {
    case 'pass':
      bgColor = colors.successBg;
      textColor = colors.success;
      icon = '✓';
      break;
    case 'fail':
      bgColor = colors.dangerBg;
      textColor = colors.danger;
      icon = '✗';
      break;
    case 'warning':
      bgColor = colors.warningBg;
      textColor = colors.warning;
      icon = '!';
      break;
    case 'pending':
    default:
      bgColor = colors.infoBg;
      textColor = colors.info;
      icon = '?';
      break;
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: bgColor,
          width: dimensions.container,
          height: dimensions.container,
        }
      ]}
    >
      <Text 
        style={[
          styles.icon, 
          { 
            color: textColor,
            fontSize: dimensions.icon,
          }
        ]}
      >
        {icon}
      </Text>
    </View>
  );
}
