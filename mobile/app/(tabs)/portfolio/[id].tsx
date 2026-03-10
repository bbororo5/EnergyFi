import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleAlert, Database, HardDrive, Layers3, ShieldCheck } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { SurfaceCard } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionHeader } from '@/components/ui/section-header';
import { StatTile } from '@/components/ui/stat-tile';
import { PieChartCard } from '@/components/charts/pie-chart';
import { BarChartCard } from '@/components/charts/bar-chart';
import { colors, radius, typography } from '@/constants/theme';
import {
  buildSettlementHistoryChart,
  formatKrwShort,
  formatPeakWindow,
  formatPercentFromBps,
  formatPeriodLabel,
  siteTypeLabel,
} from '@/hooks/use-analytics-overview';
import { useRegionAnalytics } from '@/hooks/use-region-analytics';

export default function PortfolioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { detail, regionMeta, isRefreshing, errorMessage, refresh } = useRegionAnalytics(id);

  if (!regionMeta) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle}>Analytics Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.invalidWrap}>
          <SurfaceCard>
            <Text style={styles.invalidTitle}>Unknown region</Text>
            <Text style={styles.invalidText}>This route now expects a region code such as KR11.</Text>
          </SurfaceCard>
        </View>
      </View>
    );
  }

  const siteMixData = detail?.snapshot
    ? [
        { value: Number(detail.snapshot.site.residentialBps) / 100, color: colors.sky400, label: 'Residential' },
        { value: Number(detail.snapshot.site.workplaceBps) / 100, color: colors.indigo400, label: 'Workplace' },
        { value: Number(detail.snapshot.site.publicCommercialBps) / 100, color: colors.amber400, label: 'Public-Commercial' },
        { value: Number(detail.snapshot.site.mixedBps) / 100, color: colors.emerald400, label: 'Mixed' },
      ]
    : [];

  const settlementHistory = detail ? buildSettlementHistoryChart(detail.settlement.attestationHistory) : [];
  const snapshotChange = detail?.snapshot && detail.previousSnapshot
    ? `${((Number(detail.snapshot.rhythm.sessionVolume - detail.previousSnapshot.rhythm.sessionVolume))).toLocaleString()} session delta vs ${formatPeriodLabel(detail.previousSnapshot.periodId)}`
    : 'Only the latest monthly snapshot is available.';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>{regionMeta.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>Region Hero</Text>
              <Text style={styles.heroTitle}>{regionMeta.fullName}</Text>
            </View>
            <Badge label={detail?.snapshot ? 'Published' : 'Pending'} variant={detail?.snapshot ? 'live' : 'upcoming'} dot />
          </View>

          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Pending Revenue</Text>
              <Text style={styles.heroMetricValue}>{detail ? formatKrwShort(detail.settlement.pendingRevenueKrw) : '₩0'}</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Latest Finalized</Text>
              <Text style={styles.heroMetricValue}>
                {detail?.settlement.latestAttestation
                  ? formatKrwShort(detail.settlement.latestAttestation.distributableKrw)
                  : 'Not finalized'}
              </Text>
            </View>
          </View>

          <View style={styles.heroFoot}>
            <Text style={styles.heroFootText}>
              Latest snapshot: {detail?.snapshot ? formatPeriodLabel(detail.snapshot.periodId) : 'Not published'}
            </Text>
            <Text style={styles.heroFootText}>
              STO: {detail?.stoAddress ? `Live (${detail.trancheCount} tranches)` : 'Not issued yet'}
            </Text>
          </View>
        </SurfaceCard>

        {errorMessage ? (
          <SurfaceCard style={styles.messageCard}>
            <Text style={styles.messageText}>{errorMessage}</Text>
          </SurfaceCard>
        ) : null}

        <SectionHeader
          eyebrow="SETTLEMENT PROOF"
          title="Revenue and finalization"
          icon={<Database size={18} color={colors.sky400} />}
        />

        <View style={styles.tileGrid}>
          <StatTile label="Pending Revenue" value={detail ? formatKrwShort(detail.settlement.pendingRevenueKrw) : '₩0'} />
          <StatTile
            label="Latest Period"
            value={detail?.settlement.latestAttestation ? formatPeriodLabel(detail.settlement.latestAttestation.period_yyyyMM) : 'Pending'}
            valueColor={colors.sky400}
          />
          <StatTile
            label="Latest Finalized"
            value={detail?.settlement.latestAttestation ? formatKrwShort(detail.settlement.latestAttestation.distributableKrw) : 'Not finalized'}
            valueColor={colors.emerald400}
          />
        </View>

        {settlementHistory.length > 0 ? (
          <BarChartCard title="Finalized Revenue History (₩M)" data={settlementHistory} />
        ) : (
          <SurfaceCard>
            <Text style={styles.emptySectionText}>This region has no finalized attestation history yet. It is currently read as pending-only.</Text>
          </SurfaceCard>
        )}

        <SectionHeader
          eyebrow="OPERATIONAL TRUST"
          title="Stations, chargers, and chip coverage"
          icon={<HardDrive size={18} color={colors.emerald400} />}
        />

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.tileGrid}>
            <StatTile label="Stations" value={`${detail?.coverage.activeStationCount ?? 0} / ${detail?.coverage.stationCount ?? 0}`} />
            <StatTile label="Chargers" value={`${detail?.coverage.activeChargerCount ?? 0} / ${detail?.coverage.chargerCount ?? 0}`} />
            <StatTile label="Active Chips" value={`${detail?.coverage.activeChipCount ?? 0}`} valueColor={colors.sky400} />
          </View>

          <View style={styles.progressGroup}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Active Charger Ratio</Text>
              <Text style={styles.progressValue}>
                {detail?.snapshot
                  ? formatPercentFromBps(detail.snapshot.trust.activeChargerRatioBps)
                  : detail?.coverage.activeChargerRatio != null
                    ? `${detail.coverage.activeChargerRatio.toFixed(1)}%`
                    : 'N/A'}
              </Text>
            </View>
            <ProgressBar
              value={detail?.snapshot ? Number(detail.snapshot.trust.activeChargerRatioBps) / 100 : detail?.coverage.activeChargerRatio ?? 0}
              color={colors.emerald400}
              height={8}
            />
          </View>

          <View style={styles.progressGroup}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Chip Coverage</Text>
              <Text style={styles.progressValue}>
                {detail?.coverage.chipCoverageRatio != null ? `${detail.coverage.chipCoverageRatio.toFixed(1)}%` : 'N/A'}
              </Text>
            </View>
            <ProgressBar value={detail?.coverage.chipCoverageRatio ?? 0} color={colors.sky400} height={8} />
          </View>

          <View style={styles.progressGroup}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Settlement Continuity</Text>
              <Text style={styles.progressValue}>
                {detail?.snapshot ? formatPercentFromBps(detail.snapshot.trust.settlementContinuityBps) : 'Not published'}
              </Text>
            </View>
            <ProgressBar
              value={detail?.snapshot ? Number(detail.snapshot.trust.settlementContinuityBps) / 100 : 0}
              color={colors.indigo400}
              height={8}
            />
          </View>
        </SurfaceCard>

        <SectionHeader
          eyebrow="USAGE RHYTHM"
          title="How this region moves"
          icon={<ShieldCheck size={18} color={colors.indigo400} />}
        />

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.tileGrid}>
            <StatTile
              label="Session Volume"
              value={detail?.snapshot ? detail.snapshot.rhythm.sessionVolume.toLocaleString() : 'Pending'}
              valueColor={colors.sky400}
            />
            <StatTile
              label="Revenue Stability"
              value={detail?.snapshot ? formatPercentFromBps(detail.snapshot.rhythm.revenueStabilityBps) : 'Pending'}
              valueColor={colors.emerald400}
            />
            <StatTile
              label="Peak Window"
              value={detail?.snapshot ? formatPeakWindow(detail.snapshot.rhythm.peakStartHour, detail.snapshot.rhythm.peakEndHour) : 'Pending'}
              valueColor={colors.textPrimary}
            />
          </View>

          <Text style={styles.sectionBody}>{detail?.snapshot ? snapshotChange : 'A rhythm narrative becomes available after the first monthly snapshot is published.'}</Text>
        </SurfaceCard>

        <SectionHeader
          eyebrow="SITE CHARACTER"
          title="What kind of place this region reads like"
          icon={<Layers3 size={18} color={colors.amber400} />}
        />

        {siteMixData.length > 0 ? (
          <PieChartCard
            title={`Primary type: ${detail ? siteTypeLabel(detail.snapshot?.site.primaryType ?? null) : 'Not published'}`}
            data={siteMixData}
            centerLabel={detail ? siteTypeLabel(detail.snapshot?.site.primaryType ?? null).slice(0, 5) : 'N/A'}
          />
        ) : (
          <SurfaceCard>
            <Text style={styles.emptySectionText}>Site mix is not yet published for this region.</Text>
          </SurfaceCard>
        )}

        <SectionHeader
          eyebrow="ISSUANCE READINESS"
          title="Current STO deployment state"
          icon={<CircleAlert size={18} color={colors.warning} />}
        />

        <SurfaceCard style={styles.sectionCard}>
          <View style={styles.tileGrid}>
            <StatTile
              label="STO Status"
              value={detail?.stoAddress ? 'Live' : 'Not issued'}
              valueColor={detail?.stoAddress ? colors.emerald400 : colors.textSecondary}
            />
            <StatTile
              label="Tranches"
              value={`${detail?.trancheCount ?? 0}`}
              valueColor={colors.indigo400}
            />
            <StatTile
              label="Latest Tranche"
              value={detail?.latestTrancheActiveStations ? `${detail.latestTrancheActiveStations.activeCount} / ${detail.latestTrancheActiveStations.totalCount}` : 'Not available'}
            />
          </View>

          <Text style={styles.sectionBody}>
            {detail?.stoAddress
              ? 'A token contract exists for this region. Latest tranche coverage is read directly from the STO contract.'
              : 'No region STO contract is deployed yet. Read this region as operational evidence only.'}
          </Text>
        </SurfaceCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 8,
  },
  invalidWrap: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  invalidTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  invalidText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroCard: {
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 30,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetric: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,11,17,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  heroFoot: {
    gap: 4,
  },
  heroFootText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageCard: {
    marginTop: 2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionCard: {
    gap: 16,
  },
  progressGroup: {
    gap: 8,
  },
  progressHeader: {
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
  sectionBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptySectionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
