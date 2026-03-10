import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';
import { LineChart } from 'react-native-gifted-charts';
import { CommonHeader } from '@/components/navigation/common-header';
import { SurfaceCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SmoothDigit } from '@/components/animated/smooth-digit';
import { PortfolioCarousel } from '@/components/screens/home/portfolio-carousel';
import { ImpactSection } from '@/components/screens/home/impact-section';
import { LiveFeed } from '@/components/screens/home/live-feed';
import { colors } from '@/constants/theme';
import { formatKrwShort } from '@/hooks/use-analytics-overview';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { dashboard, isLoading, isRefreshing, errorMessage, refresh } = useHomeDashboard();
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIndex !== null) {
      const timer = setTimeout(() => setSelectedIndex(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [selectedIndex]);

  const heroChart = dashboard?.heroChart ?? [];
  const currentPoint = selectedIndex != null ? heroChart[selectedIndex] : heroChart[heroChart.length - 1];
  const heroValue = currentPoint ? currentPoint.value : dashboard?.heroValue ?? 0;
  const growthPercent = dashboard?.growthPercent ?? null;
  const isGrowthPositive = growthPercent == null || growthPercent >= 0;
  const svgWidth = chartWidth > 0 ? chartWidth : 280;
  const initialSpacing = 24;
  const endSpacing = 24;
  const chartSpacing = (svgWidth - initialSpacing - endSpacing) / Math.max(heroChart.length - 1, 1);
  const chartValues = heroChart.map((item) => item.value);
  const minValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxValue = chartValues.length > 0 ? Math.max(...chartValues) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const yAxisOffset = Math.max(0, Math.floor(minValue - range * 0.25));

  const referenceLineTop = useMemo(() => {
    if (!dashboard?.averageRevenueKrw || heroChart.length === 0) {
      return null;
    }

    const averageValue = Number(dashboard.averageRevenueKrw);
    const chartMax = Math.max(maxValue, averageValue);
    const chartMin = Math.min(minValue, averageValue, yAxisOffset);
    const chartRange = Math.max(chartMax - chartMin, 1);
    return 160 - ((averageValue - chartMin) * 160) / chartRange - 10;
  }, [dashboard?.averageRevenueKrw, heroChart.length, maxValue, minValue, yAxisOffset]);

  return (
    <View style={styles.container}>
      <CommonHeader
        title="Home"
        onNotificationPress={() => router.push('/(tabs)/account/notifications')}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroLabel}>{dashboard?.heroLabel ?? 'Monthly Revenue'}</Text>
              <Text style={styles.heroSubLabel}>{dashboard?.heroSubLabel ?? 'Reading on-chain revenue facts...'}</Text>
            </View>
            <Badge
              label={dashboard?.ownershipOverlay.source === 'securities-api' ? 'ON-CHAIN + SEC' : dashboard?.ownershipOverlay.source === 'manual-input' ? 'ON-CHAIN + INPUT' : 'ON-CHAIN'}
              variant="live"
              dot
            />
          </View>

          <View style={styles.mainDigitWrap}>
            <SmoothDigit value={heroValue} prefix="₩" fontSize={48} />
          </View>

          {heroChart.length > 0 ? (
            <View
              style={styles.chartWrap}
              onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
            >
              <LineChart
                data={heroChart}
                height={160}
                width={svgWidth}
                color={colors.sky400}
                thickness={4}
                curved
                yAxisOffset={yAxisOffset}
                noOfSections={3}
                hideDataPoints={false}
                dataPointsColor={colors.white}
                dataPointsRadius={4}
                dataPointsShape="circle"
                areaChart
                startFillColor={colors.sky400}
                endFillColor={colors.sky400}
                startOpacity={0.25}
                endOpacity={0}
                xAxisColor="rgba(255,255,255,0.08)"
                yAxisColor="transparent"
                xAxisThickness={1}
                yAxisThickness={0}
                yAxisLabelWidth={0}
                hideRules
                hideYAxisText
                xAxisLabelTextStyle={styles.chartLabel}
                spacing={chartSpacing}
                initialSpacing={initialSpacing}
                endSpacing={endSpacing}
                showReferenceLine1={Boolean(dashboard?.averageRevenueKrw)}
                referenceLine1Position={dashboard?.averageRevenueKrw ? Number(dashboard.averageRevenueKrw) : undefined}
                referenceLine1Config={{
                  color: 'rgba(56, 189, 248, 0.2)',
                  thickness: 1,
                  type: 'dashed',
                  dashWidth: 4,
                  dashGap: 4,
                }}
                onPress={(_item: unknown, index: number) => setSelectedIndex(index)}
              />

              {dashboard?.averageRevenueKrw && referenceLineTop != null ? (
                <View pointerEvents="none" style={[styles.avgLabelContainer, { top: referenceLineTop }]}>
                  <View style={styles.avgLineBadge}>
                    <Text style={styles.avgLineText}>{formatKrwShort(dashboard.averageRevenueKrw)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>
                {isLoading ? 'Building the revenue history from on-chain attestations...' : 'Monthly finalized revenue will appear after the first published settlement period.'}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.portfolioBottomRow}>
            <Text style={styles.portfolioBottomLabel}>{dashboard?.footerLabel ?? 'Network Revenue'}</Text>
            <View style={styles.portfolioBottomValueRow}>
              <Text style={styles.portfolioBottomValue}>{dashboard?.footerValue ?? '—'}</Text>
              {growthPercent != null ? (
                <View style={styles.gainBadge}>
                  {isGrowthPositive ? (
                    <ArrowUpRight size={12} color={colors.sky400} />
                  ) : (
                    <ArrowDownRight size={12} color={colors.warning} />
                  )}
                  <Text style={[styles.gainBadgeText, !isGrowthPositive && styles.gainBadgeTextNegative]}>
                    {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}%
                  </Text>
                </View>
              ) : dashboard?.footerBadgeText ? (
                <View style={styles.gainBadge}>
                  <Text style={styles.gainBadgeText}>{dashboard.footerBadgeText}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </SurfaceCard>

        {errorMessage ? (
          <SurfaceCard style={styles.messageCard}>
            <Text style={styles.messageEyebrow}>READ STATUS</Text>
            <Text style={styles.messageText}>{errorMessage}</Text>
          </SurfaceCard>
        ) : null}

        <PortfolioCarousel
          cards={dashboard?.regionCards ?? []}
          isLoading={isLoading}
          onPortfolioPress={(id) => router.push(`/(tabs)/portfolio/${id}`)}
        />

        <ImpactSection impact={dashboard?.impact ?? null} isLoading={isLoading} />

        <LiveFeed sessions={dashboard?.liveSessions ?? []} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 24,
  },
  heroCard: {
    backgroundColor: '#161B26',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  heroSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  mainDigitWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  chartWrap: {
    marginTop: 12,
    marginBottom: 12,
    marginHorizontal: -12,
    height: 200,
    justifyContent: 'center',
  },
  emptyChart: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(9,11,17,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  chartLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  avgLabelContainer: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
  },
  avgLineBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  avgLineText: {
    color: colors.sky400,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  portfolioBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  portfolioBottomLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  portfolioBottomValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  portfolioBottomValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  gainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gainBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.sky400,
  },
  gainBadgeTextNegative: {
    color: colors.warning,
  },
  messageCard: {
    marginTop: -8,
  },
  messageEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
