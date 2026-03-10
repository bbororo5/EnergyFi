import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, DatabaseZap, Layers3, ShieldCheck } from 'lucide-react-native';
import { CommonHeader } from '@/components/navigation/common-header';
import { SectionHeader } from '@/components/ui/section-header';
import { SurfaceCard } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { RegionEvidenceCard } from '@/components/screens/analytics/region-evidence-card';
import { colors, radius } from '@/constants/theme';
import { formatKrwShort, useAnalyticsOverview } from '@/hooks/use-analytics-overview';

const ATTENTION_DEFAULT_LIMIT = 3;

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { overview, isLoading, isRefreshing, errorMessage, refresh } = useAnalyticsOverview();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);

  return (
    <View style={styles.container}>
      <CommonHeader
        title="Analytics"
        onNotificationPress={() => router.push('/(tabs)/account/notifications')}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 104 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>Evidence Desk</Text>
              <Text style={styles.heroTitle}>Why the network should be read this way</Text>
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

        {errorMessage ? (
          <SurfaceCard style={styles.messageCard}>
            <Text style={styles.messageEyebrow}>READ STATUS</Text>
            <Text style={styles.messageText}>{errorMessage}</Text>
          </SurfaceCard>
        ) : null}

        <SectionHeader
          eyebrow="SETTLEMENT & REVENUE PROOF"
          title="Current proof of value"
          icon={<DatabaseZap size={18} color={colors.sky400} />}
        />

        <View style={styles.cardStack}>
          <SurfaceCard style={styles.revenueCard}>
            <Text style={styles.metricEyebrow}>TOTAL PENDING REVENUE</Text>
            <Text style={styles.bigValue}>{overview ? formatKrwShort(overview.totalPendingRevenueKrw) : '₩0'}</Text>
            <Text style={styles.metricCaption}>Aggregated from `RevenueTracker.getRegionRevenue(regionId)` across the catalog.</Text>
          </SurfaceCard>

          <SurfaceCard style={styles.revenueCard}>
            <Text style={styles.metricEyebrow}>LATEST FINALIZED PERIOD</Text>
            <Text style={styles.bigValueSmall}>{overview?.latestSettlementPeriodLabel ?? 'Not finalized'}</Text>
            <Text style={styles.metricCaption}>If no attestation exists yet, regions are read as pending-only instead of empty.</Text>
          </SurfaceCard>
        </View>

        <SectionHeader
          eyebrow="OPERATIONAL INTEGRITY"
          title="Coverage and hardware trust"
          icon={<ShieldCheck size={18} color={colors.emerald400} />}
        />

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

        <SectionHeader
          eyebrow="REGION EVIDENCE"
          title="Per-region proof cards"
          icon={<Layers3 size={18} color={colors.indigo400} />}
        />

        {overview?.regions.map((region) => (
          <RegionEvidenceCard
            key={region.code}
            region={region}
            expanded={expandedRegion === region.code}
            onToggle={() => setExpandedRegion(prev => prev === region.code ? null : region.code)}
            onDetail={() => router.push(`/(tabs)/portfolio/${region.code}`)}
          />
        ))}

        <SectionHeader
          eyebrow="ATTENTION"
          title="Items that need explanation"
          icon={<CircleAlert size={18} color={colors.warning} />}
        />

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
          <SurfaceCard style={styles.emptyAttention}>
            <Text style={styles.emptyAttentionText}>
              {isLoading ? 'Reading attention states from contracts...' : 'No major attention flags surfaced from the current read set.'}
            </Text>
          </SurfaceCard>
        )}
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
