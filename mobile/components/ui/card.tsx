import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { layout, radius, shadows } from '@/constants/theme';

interface SurfaceCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function SurfaceCard({ children, style, padded = true }: SurfaceCardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  padded: {
    padding: layout.contentInset,
  },
});
