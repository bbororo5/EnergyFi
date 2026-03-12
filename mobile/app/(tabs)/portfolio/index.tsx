import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Building2, ExternalLink, ChevronRight, Wallet,
} from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { SurfaceCard } from '@/components/ui/card';
import { TabScreenLayout } from '@/components/layout/tab-screen-layout';
import { ScreenSection } from '@/components/ui/screen-section';
import { MessageStateCard } from '@/components/ui/message-state-card';
import { colors, typography, radius, shadows } from '@/constants/theme';
import { formatKrwShort } from '@/lib/domain/analytics';
import {
  type AccountPayoutRecord,
  useDemoInvestorPortfolio,
} from '@/hooks/use-demo-investor-portfolio';
import { appRoutes } from '@/lib/navigation/routes';

function PayoutStatusBadge({ status }: { status: AccountPayoutRecord['payoutStatus'] }) {
  if (status === 'Paid') {
    return <Badge label="Paid" variant="live" dot />;
  }
  if (status === 'Processing') {
    return <Badge label="Processing" variant="info" dot />;
  }
  return <Badge label="Scheduled" variant="upcoming" dot />;
}

function PayoutPreviewRow({ record }: { record: AccountPayoutRecord }) {
  return (
    <View style={styles.recordRow}>
      <View style={styles.recordRowTop}>
        <View>
          <Text style={styles.recordPeriod}>{record.periodLabel}</Text>
          <Text style={styles.recordAmount}>{formatKrwShort(record.finalizedShareKrw)}</Text>
        </View>
        <PayoutStatusBadge status={record.payoutStatus} />
      </View>

      <View style={styles.recordMetaRow}>
        <Text style={styles.recordMetaLabel}>Evidence</Text>
        <Text style={styles.recordMetaValue}>{record.evidencePublishedLabel}</Text>
      </View>

      <View style={styles.recordMetaRow}>
        <Text style={styles.recordMetaLabel}>Payout</Text>
        <Text style={styles.recordMetaValue}>{record.payoutDateLabel}</Text>
      </View>
    </View>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatShareBps(value: number | null) {
  if (value == null) {
    return 'N/A';
  }
  return `${(value / 100).toFixed(1)}%`;
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { portfolio, isLoading } = useDemoInvestorPortfolio();
  const regionPositions = portfolio?.holdings.slice(0, 4) ?? [];
  const payoutPreview = portfolio?.payoutRecords.slice(0, 3) ?? [];

  return (
    <TabScreenLayout title="Portfolio">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarBox}>
              <User size={32} color={colors.sky400} strokeWidth={2.5} />
            </View>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>Demo Investor</Text>
              <Text style={styles.profileEmail}>read-only@energyfi.demo</Text>
              <View style={styles.addressChip}>
                <Wallet size={12} color={colors.sky400} strokeWidth={2.2} />
                <Text style={styles.addressChipText}>
                  {portfolio ? shortenAddress(portfolio.holderAddress) : 'Reading wallet...'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{portfolio?.heldRegions ?? 0}</Text>
              <Text style={styles.statLabel}>REGIONS HELD</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{portfolio?.totalTokenUnits.toLocaleString() ?? '—'}</Text>
              <Text style={styles.statLabel}>TOKEN UNITS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.sky400 }]}>
                {portfolio ? formatKrwShort(portfolio.currentPendingRevenueShareKrw) : '—'}
              </Text>
              <Text style={styles.statLabel}>THIS MONTH SO FAR</Text>
            </View>
          </View>
        </SurfaceCard>

        <ScreenSection
          title="Region positions"
          intro="Live RegionSTO balances and current monthly share are shown for the demo investor across the strongest active regions."
        >
          <View style={styles.holdingsWrap}>
            {regionPositions.length > 0 ? regionPositions.map((holding) => (
              <SurfaceCard key={holding.code} style={styles.holdingCard}>
                <View style={styles.holdingHeader}>
                  <View>
                    <Text style={styles.holdingName}>{holding.name}</Text>
                    <Text style={styles.holdingMeta}>{holding.code} · {holding.balance.toLocaleString()} units</Text>
                  </View>
                  <Text style={styles.holdingShare}>{formatShareBps(holding.ownedShareBps)}</Text>
                </View>
                <View style={styles.holdingStats}>
                  <View style={styles.holdingStat}>
                    <Text style={styles.holdingStatLabel}>Monthly Share</Text>
                    <Text style={styles.holdingStatValue}>{formatKrwShort(holding.estimatedFinalizedMonthlyRevenueKrw)}</Text>
                  </View>
                  <View style={styles.holdingStat}>
                    <Text style={styles.holdingStatLabel}>This Month So Far</Text>
                    <Text style={[styles.holdingStatValue, { color: colors.sky400 }]}>
                      {formatKrwShort(holding.currentPendingRevenueShareKrw)}
                    </Text>
                  </View>
                  <View style={styles.holdingStat}>
                    <Text style={styles.holdingStatLabel}>Latest Tranche</Text>
                    <Text style={styles.holdingStatValue}>
                      {holding.latestTrancheTokenAmount != null ? holding.latestTrancheTokenAmount.toLocaleString() : '—'}
                    </Text>
                  </View>
                </View>
              </SurfaceCard>
            )) : (
              <MessageStateCard
                message={isLoading
                  ? 'EnergyFi is reading live token balances and tranche data for the demo investor.'
                  : 'Deploy and issue region STOs to populate this section.'}
              />
            )}
          </View>
        </ScreenSection>

        <ScreenSection
          title="Monthly records"
          intro="EnergyFi explains the monthly revenue record. Payout state below is shown as a demo partner timeline."
          rightElement={<Badge label="Demo partner timeline" variant="info" />}
        >
          <SurfaceCard style={styles.recordsCard}>
            {payoutPreview.length > 0 ? (
              <View style={styles.recordsList}>
                {payoutPreview.map((record) => (
                  <PayoutPreviewRow key={record.periodId.toString()} record={record} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyInlineCard}>
                <Text style={styles.emptyInlineTitle}>No monthly records yet</Text>
                <Text style={styles.emptyInlineText}>
                  Published monthly revenue records will appear here after the first finalized attestation reaches your holdings.
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View full payout history"
              accessibilityHint="Shows the complete monthly record and payout timeline"
              onPress={() => router.push(appRoutes.portfolioPayoutHistory)}
              style={({ pressed }) => [styles.historyBtn, pressed && styles.historyBtnPressed]}
            >
              <Text style={styles.historyBtnText}>View full payout history</Text>
              <ChevronRight size={18} color={colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
          </SurfaceCard>
        </ScreenSection>

        <ScreenSection
          title="Partner access"
          intro="EnergyFi explains the record. KYC, subscription, and payout execution happen on the partner platform."
        >
          <SurfaceCard style={styles.investCard}>
            <View style={styles.investIconBox}>
              <Building2 size={24} color={colors.emerald400} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.investTitle}>Partner guidance</Text>
            <Text style={styles.investSub}>EnergyFi explains the record. KYC, subscription, and payout execution happen on the partner platform.</Text>
            <View style={styles.investSteps}>
              {[
                'Review monthly records and region evidence in EnergyFi',
                'Open and verify a partner securities account',
                'Follow the partner timeline for subscription and payout events',
              ].map((text, index) => (
                <View key={index} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View partner flow"
              accessibilityHint="Explains how partner securities onboarding and payouts connect to your portfolio"
              style={({ pressed }) => [styles.investBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <ExternalLink size={16} color={colors.black} strokeWidth={2.5} />
              <Text style={styles.investBtnText}>View Partner Flow</Text>
            </Pressable>
          </SurfaceCard>
        </ScreenSection>
      </ScrollView>
    </TabScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  scroll: { paddingHorizontal: 20, gap: 8 },
  sectionLabel: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 4,
  },
  profileCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileTextWrap: { flex: 1 },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: { ...typography.h4, color: colors.textPrimary, letterSpacing: -0.3 },
  profileEmail: { ...typography.label, color: colors.textMuted, marginTop: 2 },
  addressChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.18)',
  },
  addressChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sky400,
  },
  profileDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    ...shadows.md,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,11,17,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricTileLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricTileValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  holdingsWrap: {
    gap: 12,
  },
  holdingCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  holdingName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  holdingMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  holdingShare: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.sky400,
  },
  holdingStats: {
    flexDirection: 'row',
    gap: 10,
  },
  holdingStat: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,11,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  holdingStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  holdingStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recordsCard: {
    gap: 16,
  },
  recordsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordsTextWrap: {
    flex: 1,
    gap: 6,
  },
  recordsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recordsSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recordsList: {
    gap: 12,
  },
  recordRow: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,11,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  recordRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  recordPeriod: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recordAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  recordMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  recordMetaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  recordMetaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  historyBtnPressed: {
    opacity: 0.88,
  },
  historyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyInlineCard: {
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,11,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  emptyInlineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  investCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  investIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  investTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
  investSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 16, lineHeight: 19 },
  investSteps: { gap: 12, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: { fontSize: 10, fontWeight: '700', color: colors.emerald400 },
  stepText: { fontSize: 12, fontWeight: '600', color: '#CBD5E1', flex: 1, lineHeight: 18 },
  investBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald500,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadows.glowEmerald,
  },
  investBtnText: { fontSize: 15, fontWeight: '700', color: colors.black },
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  aboutLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  version: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  demoModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
    borderColor: 'rgba(14,165,233,0.2)',
  },
  demoModeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(14,165,233,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoModeTextWrap: {
    flex: 1,
  },
  demoModeTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  demoModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
