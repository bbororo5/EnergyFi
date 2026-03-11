import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, DatabaseZap, Building2 } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { SurfaceCard } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatTile } from '@/components/ui/stat-tile';
import { colors, radius, typography } from '@/constants/theme';
import { formatKrwShort } from '@/hooks/use-analytics-overview';
import { type AccountPayoutRecord, useDemoInvestorPortfolio } from '@/hooks/use-demo-investor-portfolio';

function PayoutStatusBadge({ status }: { status: AccountPayoutRecord['payoutStatus'] }) {
  if (status === 'Paid') {
    return <Badge label="Paid" variant="live" dot />;
  }
  if (status === 'Processing') {
    return <Badge label="Processing" variant="info" dot />;
  }
  return <Badge label="Scheduled" variant="upcoming" dot />;
}

function PayoutHistoryCard({ record }: { record: AccountPayoutRecord }) {
  return (
    <SurfaceCard style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View>
          <Text style={styles.recordPeriod}>{record.periodLabel}</Text>
          <Text style={styles.recordAmount}>{formatKrwShort(record.finalizedShareKrw)}</Text>
        </View>
        <PayoutStatusBadge status={record.payoutStatus} />
      </View>

      <View style={styles.recordMetaBlock}>
        <View style={styles.recordMetaRow}>
          <Text style={styles.recordMetaLabel}>Evidence status</Text>
          <Text style={styles.recordMetaValue}>{record.evidenceStatus}</Text>
        </View>
        <View style={styles.recordMetaRow}>
          <Text style={styles.recordMetaLabel}>Evidence published</Text>
          <Text style={styles.recordMetaValue}>{record.evidencePublishedLabel}</Text>
        </View>
        <View style={styles.recordMetaRow}>
          <Text style={styles.recordMetaLabel}>Payout date</Text>
          <Text style={styles.recordMetaValue}>{record.payoutDateLabel}</Text>
        </View>
      </View>

      <View style={styles.partnerNoteBox}>
        <Text style={styles.partnerNoteLabel}>{record.partnerLabel}</Text>
        <Text style={styles.partnerNoteText}>{record.partnerNote}</Text>
      </View>
    </SurfaceCard>
  );
}

export default function PayoutHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { portfolio, isLoading } = useDemoInvestorPortfolio();
  const records = portfolio?.payoutRecords ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Payout History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text numberOfLines={1} style={styles.heroEyebrow}>Monthly records</Text>
              <Text numberOfLines={1} style={styles.heroTitle}>Records and payout timeline</Text>
            </View>
            <Badge label="Demo partner timeline" variant="info" />
          </View>

          <Text style={styles.heroBody}>
            EnergyFi publishes the monthly revenue record for your holdings. The payout status below is a demo partner overlay until a live brokerage timeline is connected.
          </Text>

          <View style={styles.heroGrid}>
            <StatTile
              label="Latest monthly share"
              value={portfolio ? formatKrwShort(portfolio.latestMonthlyShareKrw) : '—'}
            />
            <StatTile
              label="This month so far"
              value={portfolio ? formatKrwShort(portfolio.currentPendingRevenueShareKrw) : '—'}
              valueColor={colors.sky400}
            />
            <StatTile
              label="Latest payout status"
              value={portfolio?.latestPayoutStatus ?? 'Awaiting'}
              valueColor={portfolio?.latestPayoutStatus === 'Paid' ? colors.emerald400 : colors.indigo400}
            />
          </View>
        </SurfaceCard>

        <SectionHeader
          title="Recent payout timeline"
          icon={<DatabaseZap size={18} color={colors.sky400} />}
        />

        <Text style={styles.sectionIntro}>
          Each row pairs a published monthly revenue record with a demo partner payout state. The on-chain record and partner execution are deliberately shown as separate layers.
        </Text>

        {records.length > 0 ? (
          <View style={styles.recordStack}>
            {records.map((record) => (
              <PayoutHistoryCard key={record.periodId.toString()} record={record} />
            ))}
          </View>
        ) : (
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{isLoading ? 'Reading payout records' : 'No monthly records yet'}</Text>
            <Text style={styles.emptyText}>
              {isLoading
                ? 'EnergyFi is reading finalized monthly revenue for your holdings.'
                : 'Published monthly records will appear here after the first finalized attestation reaches the demo portfolio.'}
            </Text>
          </SurfaceCard>
        )}

        <SectionHeader
          title="Record vs payout"
          icon={<Building2 size={18} color={colors.emerald400} />}
        />

        <SurfaceCard style={styles.boundaryCard}>
          <View style={styles.boundaryGrid}>
            <View style={styles.boundaryPanel}>
              <Text style={styles.boundaryLabel}>On-chain record</Text>
              <Text style={styles.boundaryValue}>Monthly revenue evidence</Text>
              <Text style={styles.boundaryBody}>
                EnergyFi publishes the finalized monthly revenue record and keeps the period history readable.
              </Text>
            </View>
            <View style={styles.boundaryPanel}>
              <Text style={styles.boundaryLabel}>Partner execution</Text>
              <Text style={styles.boundaryValue}>Payout completion</Text>
              <Text style={styles.boundaryBody}>
                The securities partner owns payout execution, payment timing, and settlement completion status.
              </Text>
            </View>
          </View>
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
    paddingBottom: 16,
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
    paddingTop: 8,
    gap: 16,
  },
  heroCard: {
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 30,
    maxWidth: 260,
  },
  heroBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionIntro: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recordStack: {
    gap: 12,
  },
  recordCard: {
    gap: 14,
  },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  recordPeriod: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recordAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  recordMetaBlock: {
    gap: 8,
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
  partnerNoteBox: {
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  partnerNoteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.sky400,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  partnerNoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  boundaryCard: {
    gap: 14,
  },
  boundaryGrid: {
    gap: 12,
  },
  boundaryPanel: {
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: '#12151D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  boundaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  boundaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  boundaryBody: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
