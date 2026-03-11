import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface HeroMetricCardProps {
  icon: React.ReactNode;
  eyebrow: string;
  caption: string;
  value: string;
  valueColor?: string;
  style?: ViewStyle;
}

export function HeroMetricCard({ icon, eyebrow, caption, value, valueColor = colors.textPrimary, style }: HeroMetricCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        {icon}
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.caption}>{caption}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
