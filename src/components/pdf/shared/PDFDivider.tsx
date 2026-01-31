import { View, StyleSheet } from '@react-pdf/renderer';
import { colors, spacing } from '../styles/pdfStyles';

interface PDFDividerProps {
  color?: string;
  thickness?: number;
  marginVertical?: number;
  width?: string | number;
}

const styles = StyleSheet.create({
  divider: {
    alignSelf: 'center',
  },
});

export function PDFDivider({ 
  color = colors.border, 
  thickness = 1,
  marginVertical = spacing.itemGap,
  width = '100%',
}: PDFDividerProps) {
  return (
    <View 
      style={[
        styles.divider, 
        { 
          backgroundColor: color,
          height: thickness,
          width,
          marginVertical,
        }
      ]} 
    />
  );
}

// Gradient-like divider using primary color
export function PDFPrimaryDivider({ 
  marginVertical = spacing.itemGap,
  width = 120,
}: Omit<PDFDividerProps, 'color' | 'thickness'>) {
  return (
    <View 
      style={[
        styles.divider, 
        { 
          backgroundColor: colors.primary,
          height: 2,
          width,
          marginVertical,
          borderRadius: 1,
        }
      ]} 
    />
  );
}
