import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleAlert, Clock3, Database, HardDrive, Layers3, ShieldCheck } from 'lucide-react-native';
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
} from '@/lib/domain/analytics';
import { useRegionAnalytics } from '@/hooks/use-region-analytics';

function getSectionIntro(title: string) {
  switch (title) {
    case 'trust':
      return 'This screen explains the same region through contract-readable evidence, not projections or rankings.';
    case 'settlement':
      return 'Revenue is read from published monthly evidence first, with pending revenue shown separately until finalization.';
    case 'operations':
      return 'Operational health is expressed through active charger coverage, chip reporting, and settlement continuity.';
    case 'rhythm':
      return 'Usage rhythm turns the latest monthly snapshot into a readable operational pattern.';
    case 'pattern':
      return 'Region pattern describes the latest published site mix in plain language instead of raw taxonomy labels.';
    case 'issuance':
      return 'Issuance stays below the evidence layers so the page still works as an explanation surface before STO launch.';
    default:
      return '';
  }
}

function getNarrativeToneColor(tone: 'sky' | 'emerald' | 'indigo' | 'neutral') {
  switch (tone) {
    case 'sky':
      return colors.sky400;
    case 'emerald':
      return colors.emerald400;
    case 'indigo':
      return colors.indigo400;
    default:
      return colors.textMuted;
  }
}

export function RegionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { detail, regionMeta, isRefreshing, errorMessage, refresh } = useRegionAnalytics(id);

  if (!regionMeta) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous screen"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
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
            <View style={styles.heroTopText}>
              <Text style={styles.heroEyebrow}>Region Evidence Desk</Text>
              <Text style={styles.heroTitle}>{regionMeta.fullName}</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>Explore detail</Text>
            </View>
          </View>

          <Text style={styles.heroBody}>
            Explore reads this region through operational trust, revenue rhythm, and pattern evidence. Home only previews that story.
          </Text>

          <View style={styles.heroRevenueBlock}>
            <Text style={styles.heroRevenueLabel}>{detail?.narratives.heroRevenueLabel ?? 'Latest monthly revenue'}</Text>
            <Text style={styles.heroRevenueValue}>{detail?.narratives.heroRevenueValue ?? 'Awaiting'}</Text>
          </View>

          <View style={styles.heroSupportGrid}>
            {(detail?.narratives.heroSupportItems ?? []).map((item) => (
              <View key={item.label} style={styles.heroSupportCard}>
                <Text style={styles.heroSupportLabel}>{item.label}</Text>
                <Text style={[styles.heroSupportValue, { color: getNarrativeToneColor(item.tone) }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {errorMessage ? (
          <SurfaceCard style={styles.messageCard}>
            <Text style={styles.messageEyebrow}>READ STATUS</Text>
            <Text style={styles.messageText}>{errorMessage}</Text>
          </SurfaceCard>
        ) : null}

        <SectionHeader
          title="Why this record holds"
          icon={<ShieldCheck size={18} color={colors.emerald400} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('trust')}</Text>

        <View style={styles.narrativeStack}>
          {(detail?.narratives.trustItems ?? []).map((item) => (
            <SurfaceCard key={item.title} style={styles.narrativeCard}>
              <Text style={[styles.narrativeTitle, { color: getNarrativeToneColor(item.tone) }]}>{item.title}</Text>
              <Text style={styles.narrativeBody}>{item.description}</Text>
            </SurfaceCard>
          ))}
        </View>

        <SectionHeader
          title="Revenue and finalization"
          icon={<Database size={18} color={colors.sky400} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('settlement')}</Text>

        <View style={styles.tileGrid}>
          <StatTile label="Pending Revenue" value={detail ? formatKrwShort(detail.settlement.pendingRevenueKrw) : '₩0'} />
          <StatTile
            label="Latest Published Month"
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
            <Text style={styles.emptySectionText}>This region has no finalized attestation history yet. It currently reads as pending-only.</Text>
          </SurfaceCard>
        )}

        <SectionHeader
          title="Coverage and chip trust"
          icon={<HardDrive size={18} color={colors.emerald400} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('operations')}</Text>

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
          title="How this region moves"
          icon={<Clock3 size={18} color={colors.indigo400} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('rhythm')}</Text>

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

          <Text style={styles.sectionBody}>
            {detail?.narratives.rhythmNarrative ?? 'A usage narrative becomes available after the first monthly snapshot is published.'}
          </Text>
        </SurfaceCard>

        <SectionHeader
          title="Latest region pattern"
          icon={<Layers3 size={18} color={colors.amber400} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('pattern')}</Text>

        {siteMixData.length > 0 ? (
          <View style={styles.sectionStack}>
            <PieChartCard
              title={detail?.narratives.siteNarrativeLabel ?? 'Pattern not published'}
              data={siteMixData}
              centerLabel={detail?.narratives.siteNarrativeShortLabel ?? 'N/A'}
            />
            <SurfaceCard>
              <Text style={styles.sectionBody}>{detail?.narratives.siteNarrativeBody}</Text>
            </SurfaceCard>
          </View>
        ) : (
          <SurfaceCard>
            <Text style={styles.emptySectionText}>Site mix is not yet published for this region.</Text>
          </SurfaceCard>
        )}

        <SectionHeader
          title="Current issuance state"
          icon={<CircleAlert size={18} color={colors.warning} />}
        />
        <Text style={styles.sectionIntro}>{getSectionIntro('issuance')}</Text>

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
              label="Total Supply"
              value={detail?.totalSupply != null ? detail.totalSupply.toLocaleString() : '0'}
              valueColor={colors.sky400}
            />
            <StatTile
              label="Latest Tranche"
              value={detail?.latestTrancheActiveStations ? `${detail.latestTrancheActiveStations.activeCount} / ${detail.latestTrancheActiveStations.totalCount} active stations` : 'Not available'}
            />
          </View>

          <Text style={styles.sectionBody}>
            {detail?.narratives.issuanceNarrative ?? 'No region STO contract is deployed yet. Read this region as operational evidence only.'}
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
    gap: 18,
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
    padding: 24,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTopText: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
    maxWidth: 240,
  },
  heroChip: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  heroBody: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 21,
  },
  heroRevenueBlock: {
    gap: 8,
  },
  heroRevenueLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroRevenueValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  heroSupportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroSupportCard: {
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 100,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  heroSupportLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroSupportValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
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
  sectionIntro: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  narrativeStack: {
    gap: 12,
  },
  narrativeCard: {
    gap: 10,
  },
  narrativeTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  narrativeBody: {
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
    gap: 18,
  },
  sectionStack: {
    gap: 12,
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
