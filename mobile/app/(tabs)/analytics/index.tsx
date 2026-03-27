import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, DatabaseZap, Layers3, ShieldCheck } from 'lucide-react-native';
import { TabScreenLayout } from '@/components/layout/tab-screen-layout';
import { SurfaceCard } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { ScreenSection } from '@/components/ui/screen-section';
import { MessageStateCard } from '@/components/ui/message-state-card';
import { MetricPairCard } from '@/components/ui/metric-pair-card';
import { RegionEvidenceCard } from '@/components/screens/analytics/region-evidence-card';
import { colors, radius } from '@/constants/theme';
import { formatKrwShort } from '@/lib/domain/analytics';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';
import { appRoutes } from '@/lib/navigation/routes';

const ATTENTION_DEFAULT_LIMIT = 3;

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { overview, isLoading, isRefreshing, errorMessage, refresh } = useAnalyticsOverview();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);

  return (
    <TabScreenLayout title="Analytics">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 104 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>Evidence Desk</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>Read the network</Text>
            </View>
            <Badge label="Guest Safe" variant="info" dot />
          </View>

          <Text style={styles.heroBody}>
            Analytics explains the system with directly readable contract evidence: sessions, settlement records, operational coverage, and issuance readiness.
          </Text>

          <View style={styles.heroGrid}>
            <StatTile label="Sessions" value={overview?.totalSessions?.toLocaleString() ?? '—'} />
            <StatTile label="Published Regions" value={`${overview?.publishedRegions ?? 0}`} valueColor={colors.sky400} />
            <StatTile label="Latest Settlement" value={overview?.latestSettlementPeriodLabel ?? '—'} valueColor={colors.emerald400} />
            <StatTile label="STO Live Regions" value={`${overview?.liveStoRegions ?? 0}`} valueColor={colors.indigo400} />
          </View>
        </SurfaceCard>

        {errorMessage ? <MessageStateCard message={errorMessage} tone="warning" /> : null}

        <ScreenSection
          title="Current proof of value"
          icon={<DatabaseZap size={18} color={colors.sky400} />}
          intro="These two values summarize the network-wide read before you inspect region-level detail."
        >
          <MetricPairCard
            left={{
              label: 'Total pending revenue',
              value: overview ? formatKrwShort(overview.totalPendingRevenueKrw) : '₩0',
              caption: 'Aggregated from RevenueTracker.getRegionRevenue(regionId) across the catalog.',
            }}
            right={{
              label: 'Latest finalized period',
              value: overview?.latestSettlementPeriodLabel ?? 'Not finalized',
              valueColor: colors.emerald400,
              caption: 'If no attestation exists yet, regions are read as pending-only instead of empty.',
            }}
          />
        </ScreenSection>

        <ScreenSection
          title="Coverage and hardware trust"
          icon={<ShieldCheck size={18} color={colors.emerald400} />}
          intro="Hardware activity and chip coverage explain how much live operational evidence is flowing into the system."
        >
          <SurfaceCard style={styles.integrityCard}>
            <View style={styles.integrityRow}>
              <View style={styles.integrityMetric}>
                <Text style={styles.metricEyebrow}>Stations</Text>
                <Text style={styles.metricValue}>{overview?.aggregateActiveStations ?? 0} / {overview?.aggregateStations ?? 0}</Text>
              </View>
              <View style={styles.integrityMetric}>
                <Text style={styles.metricEyebrow}>Chargers</Text>
                <Text style={styles.metricValue}>{overview?.aggregateActiveChargers ?? 0} / {overview?.aggregateChargers ?? 0}</Text>
              </View>
              <View style={styles.integrityMetric}>
                <Text style={styles.metricEyebrow}>Chip Coverage</Text>
                <Text style={[styles.metricValue, { color: colors.sky400 }]}>
                  {overview?.aggregateActiveChipCoverage != null ? `${overview.aggregateActiveChipCoverage.toFixed(1)}%` : 'N/A'}
                </Text>
              </View>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Active Charger Coverage</Text>
                <Text style={styles.progressValue}>
                  {overview?.aggregateChargers
                    ? `${((overview.aggregateActiveChargers / overview.aggregateChargers) * 100).toFixed(1)}%`
                    : 'N/A'}
                </Text>
              </View>
              <ProgressBar
                value={overview?.aggregateChargers ? (overview.aggregateActiveChargers / overview.aggregateChargers) * 100 : 0}
                color={colors.emerald400}
                height={8}
              />
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Active Chip Coverage</Text>
                <Text style={styles.progressValue}>
                  {overview?.aggregateActiveChipCoverage != null ? `${overview.aggregateActiveChipCoverage.toFixed(1)}%` : 'N/A'}
                </Text>
              </View>
              <ProgressBar
                value={overview?.aggregateActiveChipCoverage ?? 0}
                color={colors.sky400}
                height={8}
              />
            </View>
          </SurfaceCard>
        </ScreenSection>

        <ScreenSection
          title="Per-region proof cards"
          icon={<Layers3 size={18} color={colors.indigo400} />}
          intro="Each card combines settlement, hardware coverage, usage rhythm, and issuance context for a single region."
        >
          {overview?.regions.map((region) => (
            <RegionEvidenceCard
              key={region.code}
              region={region}
              expanded={expandedRegion === region.code}
              onToggle={() => setExpandedRegion(prev => prev === region.code ? null : region.code)}
              onDetail={() => router.push(appRoutes.regionDetail(region.code))}
            />
          ))}
        </ScreenSection>

        <ScreenSection
          title="Items needing context"
          icon={<CircleAlert size={18} color={colors.warning} />}
          intro="These are not failures by default. They are the current areas where the reader may want more context."
        >
          {overview && overview.attention.length > 0 ? (
            <>
              {overview.attention
                .slice(0, showAllAttention ? undefined : ATTENTION_DEFAULT_LIMIT)
                .map((item, index) => (
                  <SurfaceCard key={`${item.regionCode}-${index}`} style={styles.attentionCard}>
                    <View style={styles.attentionLeft}>
                      <View style={[
                        styles.attentionDot,
                        item.tone === 'warning' ? styles.attentionDotWarning : styles.attentionDotInfo,
                      ]} />
                      <View style={styles.attentionTextWrap}>
                        <Text style={styles.attentionRegion}>{item.regionCode}</Text>
                        <Text style={styles.attentionMessage}>{item.message}</Text>
                      </View>
                    </View>
                  </SurfaceCard>
                ))}
              {!showAllAttention && overview.attention.length > ATTENTION_DEFAULT_LIMIT && (
                <Pressable onPress={() => setShowAllAttention(true)} style={({ pressed }) => [styles.showMoreBtn, pressed && styles.showMorePressed]}>
                  <Text style={styles.showMoreText}>Show {overview.attention.length - ATTENTION_DEFAULT_LIMIT} more</Text>
                </Pressable>
              )}
            </>
          ) : (
            <MessageStateCard
              message={isLoading ? 'Reading attention states from contracts...' : 'No major attention flags surfaced from the current read set.'}
            />
          )}
        </ScreenSection>
      </ScrollView>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  heroCard: {
    padding: 24,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 30,
    maxWidth: 240,
  },
  heroBody: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 21,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  messageCard: {
    marginTop: 2,
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
  cardStack: {
    gap: 12,
  },
  revenueCard: {
    gap: 10,
  },
  metricEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bigValue: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.white,
  },
  bigValueSmall: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  metricCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  integrityCard: {
    gap: 18,
  },
  integrityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  integrityMetric: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,11,17,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  progressBlock: {
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  attentionCard: {
    marginBottom: 10,
  },
  attentionLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  attentionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  attentionDotWarning: {
    backgroundColor: colors.warning,
  },
  attentionDotInfo: {
    backgroundColor: colors.sky400,
  },
  attentionTextWrap: {
    flex: 1,
  },
  attentionRegion: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  attentionMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  showMoreBtn: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  showMorePressed: {
    opacity: 0.7,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  emptyAttention: {
    marginBottom: 6,
  },
  emptyAttentionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
