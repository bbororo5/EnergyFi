import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Layers3, RotateCw } from 'lucide-react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { LineChart } from 'react-native-gifted-charts';
import { Badge } from '@/components/ui/badge';
import { FlipCard } from '@/components/animated/flip-card';
import { SectionHeader } from '@/components/ui/section-header';
import { colors, radius } from '@/constants/theme';
import type { HomeRegionCardData } from '@/hooks/use-home-dashboard';

function CardFront({ card, onFlip }: { card: HomeRegionCardData; onFlip: () => void }) {
  // Prep micro chart data
  const chartValues = card.chartData.map(item => item.value);
  const minValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxValue = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const yAxisOffset = Math.max(0, Math.floor(minValue - range * 0.1));
  const cleanChartData = card.chartData.map(item => ({
    value: item.value,
    dataPointText: '',
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${card.name} region summary`}
      accessibilityHint="Flips the card to show a short operational brief"
      onPress={onFlip}
      style={({ pressed }) => [styles.front, pressed && styles.cardPressed]}
    >
      <View style={styles.frontTopBar}>
        <View style={styles.regionBadge}>
          <View style={styles.regionDot} />
          <Text style={styles.regionBadgeText}>{card.name.toUpperCase()}</Text>
        </View>
        <Badge label="ACTIVE" variant="live" dot />
      </View>

      <View style={styles.frontTitleArea}>
        <Text style={styles.revenueLabel}>{card.frontRevenueLabel}</Text>
        <Text style={styles.revenueValue}>{card.frontRevenueValue}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{card.frontCoverageLabel}</Text>
          <Text style={[styles.statValue, { color: colors.emerald400 }]}>{card.frontCoverageValue}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TREND</Text>
          <Text style={[styles.statValue, { color: colors.sky400 }]}>{card.frontTrendEyebrow}</Text>
        </View>
      </View>

      <View style={styles.sparklineContainer}>
        {cleanChartData.length > 0 ? (
          <LineChart
            data={cleanChartData}
            height={80}
            width={240}
            thickness={3}
            color={colors.sky400}
            startFillColor={colors.sky400}
            endFillColor={colors.sky400}
            startOpacity={0.25}
            endOpacity={0}
            areaChart
            yAxisOffset={yAxisOffset}
            hideDataPoints
            xAxisColor="transparent"
            yAxisColor="transparent"
            xAxisThickness={0}
            yAxisThickness={0}
            hideRules
            hideYAxisText
            initialSpacing={0}
            endSpacing={0}
            isAnimated
          />
        ) : (
          <Text style={styles.emptyChartText}>Awaiting evidence</Text>
        )}
      </View>

      <View style={styles.flipHint}>
        <RotateCw size={12} color={colors.textMuted} />
        <Text style={styles.flipHintText}>Tap for brief</Text>
      </View>
    </Pressable>
  );
}

function CardBack({ card, onPress, onFlip }: { card: HomeRegionCardData; onPress?: () => void; onFlip: () => void }) {
  const backSummaryItems = card.backSummaryItems || [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Close ${card.name} region summary`}
      accessibilityHint="Returns to the front of the region card"
      onPress={onFlip}
      style={({ pressed }) => [styles.back, pressed && styles.cardPressed]}
    >
      <View style={styles.backHeader}>
        <Text style={styles.backTitle}>Region Evidence</Text>
        <Layers3 size={18} color={colors.textMuted} />
      </View>

      <View style={styles.backSummaryStack}>
        {backSummaryItems.map((item) => (
          <View key={item.title} style={styles.backSummaryCard}>
            <Text style={[styles.backMetricLabel, { color: item.tone === 'sky' ? colors.sky400 : item.tone === 'emerald' ? colors.emerald400 : item.tone === 'indigo' ? colors.indigo400 : colors.textMuted }]}>{item.title}</Text>
            <Text style={styles.backMetricValue}>{item.description}</Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${card.name} analytics`}
        accessibilityHint="Opens the detailed analytics screen for this region"
        onPress={(e) => { e.stopPropagation(); onPress?.(); }}
        style={styles.exploreBtn}
      >
        <Text style={styles.exploreBtnText}>OPEN ANALYTICS</Text>
      </Pressable>
    </Pressable>
  );
}

interface PortfolioCarouselProps {
  cards: HomeRegionCardData[];
  isLoading?: boolean;
  onPortfolioPress?: (id: string) => void;
}

export function PortfolioCarousel({ cards, isLoading = false, onPortfolioPress }: PortfolioCarouselProps) {
  const { width } = useWindowDimensions();
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
  const cardWidth = Math.min(Math.max(width - 72, 280), 340);

  useEffect(() => {
    if (flippedCardId && !cards.some((card) => card.id === flippedCardId)) {
      setFlippedCardId(null);
    }
  }, [cards, flippedCardId]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Current top regions"
        rightElement={<Badge label="ON-CHAIN" variant="live" dot />}
      />

      {isLoading ? (
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholderText}>Loading region evidence...</Text>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholderText}>Region evidence will appear after contract reads complete.</Text>
        </View>
      ) : (
        <View style={styles.carouselWrap}>
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
                  flipped={flippedCardId === card.id}
                  front={<CardFront card={card} onFlip={() => setFlippedCardId(prev => prev === card.id ? null : card.id)} />}
                  back={<CardBack card={card} onFlip={() => setFlippedCardId(null)} onPress={() => onPortfolioPress?.(card.id)} />}
                  height={380}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginTop: 12,
  },
  carouselWrap: {
    marginHorizontal: -20,
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
  cardPressed: {
    opacity: 0.94,
  },
  frontTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  regionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sky400,
  },
  regionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  frontTitleArea: {
    marginTop: 8,
    marginBottom: 16,
  },
  revenueLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.8,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  sparklineContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    paddingTop: 10,
  },
  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
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
  backSummaryStack: {
    gap: 10,
  },
  backSummaryCard: {
    backgroundColor: 'rgba(30,35,51,0.88)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  backMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  backMetricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 6,
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
