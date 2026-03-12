import { StyleSheet, Text, View } from 'react-native';
import { SurfaceCard } from '@/components/ui/card';
import { colors, radius, typography } from '@/constants/theme';

interface MetricItem {
  label: string;
  value: string;
  valueColor?: string;
  caption?: string;
}

interface MetricPairCardProps {
  left: MetricItem;
  right: MetricItem;
}

function MetricBlock({ item }: { item: MetricItem }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{item.label}</Text>
      <Text style={[styles.value, item.valueColor ? { color: item.valueColor } : null]}>{item.value}</Text>
      {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
    </View>
  );
}

export function MetricPairCard({ left, right }: MetricPairCardProps) {
  return (
    <SurfaceCard style={styles.card}>
      <MetricBlock item={left} />
      <View style={styles.divider} />
      <MetricBlock item={right} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  block: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 8,
  },
  value: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  divider: {
    width: 1,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
