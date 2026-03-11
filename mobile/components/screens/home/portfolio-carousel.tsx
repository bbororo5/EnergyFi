import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Layers3, RotateCw } from 'lucide-react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BarChart } from 'react-native-gifted-charts';
import { Badge } from '@/components/ui/badge';
import { FlipCard } from '@/components/animated/flip-card';
import { colors, radius } from '@/constants/theme';
import type { HomeRegionCardData } from '@/hooks/use-home-dashboard';

function CardFront({ card }: { card: HomeRegionCardData }) {
  return (
    <View style={styles.front}>
      <View style={styles.frontHeader}>
        <View style={styles.regionBadge}>
          <View style={styles.regionDot} />
          <Text style={styles.regionBadgeText}>{card.stationCount} STATIONS</Text>
        </View>
        <Badge label={card.published ? 'PUBLISHED' : 'AWAITING'} variant={card.published ? 'live' : 'upcoming'} />
      </View>

      <View style={styles.frontTitleArea}>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.cardSub}>{card.siteLabel}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>PENDING</Text>
          <Text style={styles.statValue}>{card.pendingRevenueLabel}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>FINALIZED</Text>
          <Text style={[styles.statValue, { color: colors.sky400 }]}>{card.latestFinalizedLabel}</Text>
        </View>
      </View>

      <View style={styles.frontChartArea}>
        <BarChart
          data={card.chartData.map((item) => ({ ...item, frontColor: colors.sky400 }))}
          height={80}
          width={220}
          barWidth={16}
          spacing={8}
          hideRules
          xAxisThickness={0}
          yAxisThickness={0}
          hideYAxisText
          barBorderRadius={4}
          initialSpacing={5}
        />
      </View>

      <View style={styles.flipHint}>
        <RotateCw size={12} color={colors.textMuted} />
        <Text style={styles.flipHintText}>Tap to flip</Text>
      </View>
    </View>
  );
}

function CardBack({ card, onPress }: { card: HomeRegionCardData; onPress?: () => void }) {
  const metrics = [
    { label: 'Active Coverage', value: card.activeCoverageLabel, color: colors.sky400 },
    { label: 'Snapshot', value: card.snapshotLabel, color: colors.textPrimary },
    { label: 'Issuance', value: card.issuanceLabel, color: colors.indigo400 },
    { label: 'Site Type', value: card.siteLabel, color: colors.emerald400 },
  ];

  return (
    <View style={styles.back}>
      <View style={styles.backHeader}>
        <Text style={styles.backTitle}>Region Evidence</Text>
        <Layers3 size={18} color={colors.textMuted} />
      </View>

      <View style={styles.backGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.backMetric}>
            <Text style={styles.backMetricLabel}>{metric.label}</Text>
            <Text style={[styles.backMetricValue, { color: metric.color }]}>{metric.value}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onPress} style={styles.exploreBtn}>
        <Text style={styles.exploreBtnText}>OPEN ANALYTICS</Text>
      </Pressable>
    </View>
  );
}

interface PortfolioCarouselProps {
  cards: HomeRegionCardData[];
  isLoading?: boolean;
  onPortfolioPress?: (id: string) => void;
}

export function PortfolioCarousel({ cards, isLoading = false, onPortfolioPress }: PortfolioCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(Math.max(width - 72, 280), 340);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.placeholderWrap]}>
        <Text style={styles.placeholderText}>Loading region evidence...</Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={[styles.container, styles.placeholderWrap]}>
        <Text style={styles.placeholderText}>Region evidence will appear after contract reads complete.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={cardWidth + 16}
        decelerationRate="fast"
      >
        {cards.map((card) => (
          <View key={card.id} style={[styles.cardWrap, { width: cardWidth }]}>
            <FlipCard
              front={<CardFront card={card} />}
              back={<CardBack card={card} onPress={() => onPortfolioPress?.(card.id)} />}
              height={380}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -20,
    marginTop: 12,
  },
  placeholderWrap: {
    height: 380,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  cardWrap: {
    height: 380,
  },
  front: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  frontHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  regionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sky400,
  },
  regionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  frontTitleArea: {
    alignItems: 'center',
    marginTop: 10,
  },
  cardName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 82,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  frontChartArea: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.6,
  },
  flipHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  back: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  backHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  backGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  backMetric: {
    width: '48%',
    backgroundColor: '#1E2333',
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  backMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  backMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  exploreBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  exploreBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
});
