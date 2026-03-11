import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '@/constants/theme';
import type { RegionStoryChip } from '@/hooks/use-region-stories';

interface StoryChipProps {
  chip: RegionStoryChip;
}

const toneMap = {
  trust: {
    border: 'rgba(52,211,153,0.18)',
    background: 'rgba(16,185,129,0.09)',
    label: colors.emerald400,
  },
  rhythm: {
    border: 'rgba(56,189,248,0.18)',
    background: 'rgba(14,165,233,0.08)',
    label: colors.sky400,
  },
  site: {
    border: 'rgba(129,140,248,0.18)',
    background: 'rgba(99,102,241,0.08)',
    label: colors.indigo400,
  },
} as const;

export function StoryChip({ chip }: StoryChipProps) {
  const tone = toneMap[chip.tone];

  return (
    <View style={[styles.container, { borderColor: tone.border, backgroundColor: tone.background }]}>
      <Text style={[styles.label, { color: tone.label }]}>{chip.label}</Text>
      <Text style={styles.detail}>{chip.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  detail: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
