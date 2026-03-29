import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Database, Layers3, ShieldCheck, Sparkles } from 'lucide-react-native';
import { SurfaceCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { colors, radius } from '@/constants/theme';
import type { RegionStoryCardData } from '@/hooks/use-region-stories';
import { StoryChip } from '@/components/screens/explore/story-chip';

interface RegionStoryCardProps {
  story: RegionStoryCardData;
  onPress?: () => void;
}

export function RegionStoryCard({ story, onPress }: RegionStoryCardProps) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress
          ? `Open ${story.name} region story`
          : `${story.name} region story unavailable`
      }
      accessibilityHint={
        onPress
          ? 'Shows the detailed regional evidence view'
          : 'This region becomes interactive after the first monthly snapshot is published'
      }
      onPress={onPress}
      style={({ pressed }) => [pressed && onPress ? styles.pressed : undefined]}
    >
      <SurfaceCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.regionIcon, story.published ? styles.regionIconLive : styles.regionIconPending]}>
              {story.published ? <Sparkles size={16} color={colors.sky400} /> : <Database size={16} color={colors.textMuted} />}
            </View>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{story.name}</Text>
                <Text style={styles.code}>{story.code}</Text>
              </View>
              <Text style={styles.fullName} numberOfLines={1}>
                {story.fullName}
              </Text>
            </View>
          </View>
          <Badge label={story.published ? 'Published' : 'Awaiting'} variant={story.published ? 'live' : 'upcoming'} dot />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>MONTHLY SNAPSHOT</Text>
          <Text style={styles.metaValue}>{story.periodLabel}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaValue}>{story.updatedLabel}</Text>
        </View>

        <Text style={styles.summary}>{story.summary}</Text>
        <Text style={styles.changeSummary}>{story.changeSummary}</Text>

        {story.published ? (
          <>
            <View style={styles.chipList}>
              {story.chips.map((chip) => (
                <StoryChip key={`${story.regionId}-${chip.axis}`} chip={chip} />
              ))}
            </View>

            <View style={styles.metricsRow}>
              {story.metrics.map((metric) => (
                <View key={`${story.regionId}-${metric.label}`} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={[styles.metricValue, { color: metric.accentColor }]}>{metric.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <View style={styles.footerHint}>
                <ShieldCheck size={14} color={colors.emerald400} />
                <Text style={styles.footerText}>Narrative is composed from on-chain reputation metrics</Text>
              </View>
              {onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
            </View>
          </>
        ) : (
          <View style={styles.pendingBlock}>
            <View style={styles.pendingRow}>
              <Layers3 size={14} color={colors.textMuted} />
              <Text style={styles.pendingText}>This region remains visible, but neutral, until a monthly snapshot is published.</Text>
            </View>
          </View>
        )}
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  card: {
    gap: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  regionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  regionIconLive: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderColor: 'rgba(14,165,233,0.18)',
  },
  regionIconPending: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  code: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fullName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  summary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  changeSummary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chipList: {
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,11,17,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  pendingBlock: {
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,11,17,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pendingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  pendingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
