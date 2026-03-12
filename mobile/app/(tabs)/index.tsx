import { Text, ScrollView, StyleSheet, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabScreenLayout } from '@/components/layout/tab-screen-layout';
import { SurfaceCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SmoothDigit } from '@/components/animated/smooth-digit';
import { PortfolioCarousel } from '@/components/screens/home/portfolio-carousel';
import { ImpactSection } from '@/components/screens/home/impact-section';
import { LiveFeed } from '@/components/screens/home/live-feed';
import { HeroRevenueChart } from '@/components/screens/home/hero-revenue-chart';
import { colors } from '@/constants/theme';
import { useHomeDashboard } from '@/hooks/use-home-dashboard';
import { appRoutes } from '@/lib/navigation/routes';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { dashboard, isLoading, isRefreshing, errorMessage, refresh } = useHomeDashboard();

  const heroChart = dashboard?.heroChart ?? [];
  const heroValue = dashboard?.heroValue ?? 0;
  const heroLabel = dashboard?.heroLabel ?? 'Current month revenue';
  const heroSubLabel = dashboard?.heroSubLabel ?? 'Reading on-chain revenue facts...';

  return (
    <TabScreenLayout title="Home">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroLabel}>{heroLabel}</Text>
              <Text style={styles.heroSubLabel}>{heroSubLabel}</Text>
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
            <HeroRevenueChart data={heroChart} />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>
                {isLoading ? 'Building the published monthly record from on-chain attestations...' : 'Published monthly records will appear after the first evidence cycle closes.'}
              </Text>
            </View>
          )}

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
          onPortfolioPress={(id) => router.push(appRoutes.regionDetail(id))}
        />

        <ImpactSection impact={dashboard?.impact ?? null} isLoading={isLoading} />

        <LiveFeed sessions={dashboard?.liveSessions ?? []} />
      </ScrollView>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
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
