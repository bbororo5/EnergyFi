import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface StatTileProps {
  label: string;
  value: string;
  valueColor?: string;
  style?: ViewStyle;
}

export function StatTile({ label, value, valueColor = colors.textPrimary, style }: StatTileProps) {
  return (
    <View style={[styles.tile, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: 12,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
