import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight, CircleAlert, MapPin, ShieldCheck } from 'lucide-react-native';
import { SurfaceCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { colors, radius } from '@/constants/theme';
import {
  formatKrwShort,
  formatPeakWindow,
  formatPercentFromBps,
  siteTypeLabel,
  type RegionEvidenceSummary,
} from '@/lib/domain/analytics';

interface RegionEvidenceCardProps {
  region: RegionEvidenceSummary;
  expanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
}

export function RegionEvidenceCard({ region, expanded, onToggle, onDetail }: RegionEvidenceCardProps) {
  const chargerRatio = region.snapshot
    ? formatPercentFromBps(region.snapshot.trust.activeChargerRatioBps)
    : region.coverage.activeChargerRatio != null
      ? `${region.coverage.activeChargerRatio.toFixed(1)}%`
      : 'N/A';

  const peakWindow = region.snapshot
    ? formatPeakWindow(region.snapshot.rhythm.peakStartHour, region.snapshot.rhythm.peakEndHour)
    : 'Pending';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${region.name} evidence card`}
      accessibilityHint={expanded ? 'Collapses the region evidence summary' : 'Expands the region evidence summary'}
      onPress={onToggle}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <SurfaceCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <MapPin size={16} color={colors.sky400} />
            </View>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{region.name}</Text>
                <Text style={styles.code}>{region.code}</Text>
              </View>
              {expanded && (
                <Text style={styles.subtitle} numberOfLines={1}>{region.fullName}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Badge label={region.snapshot ? 'Published' : 'Pending'} variant={region.snapshot ? 'live' : 'upcoming'} dot />
            {expanded
              ? <ChevronDown size={18} color={colors.textMuted} />
              : <ChevronRight size={18} color={colors.textMuted} />}
          </View>
        </View>

        {!expanded && (
          <Text style={styles.collapsedSummary}>
            {formatKrwShort(region.settlement.pendingRevenueKrw)}  ·  {chargerRatio}  ·  {peakWindow}
          </Text>
        )}

        {expanded && (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Pending Revenue</Text>
                <Text style={styles.metricValue}>{formatKrwShort(region.settlement.pendingRevenueKrw)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Active Chargers</Text>
                <Text style={styles.metricValue}>{chargerRatio}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Peak Window</Text>
                <Text style={styles.metricValue}>{peakWindow}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <ShieldCheck size={14} color={colors.emerald400} />
                <Text style={styles.metaText}>
                  {region.snapshot ? siteTypeLabel(region.snapshot.site.primaryType) : 'Site not published'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaText}>
                  {region.settlement.latestAttestation
                    ? `Finalized ${formatKrwShort(region.settlement.latestAttestation.distributableKrw)}`
                    : 'Pending only'}
                </Text>
              </View>
            </View>

            {region.attention.length > 0 ? (
              <View style={styles.attentionBox}>
                <CircleAlert size={14} color={colors.warning} />
                <Text style={styles.attentionText}>{region.attention[0]}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${region.name} detailed analytics`}
              accessibilityHint="Shows the full evidence desk for this region"
              onPress={onDetail}
              style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}
            >
              <Text style={styles.footerText}>
                {region.stoAddress
                  ? region.ownedShareBps != null
                    ? `Issuance live · ${region.trancheCount} tranches · ${(region.ownedShareBps / 100).toFixed(1)}% held`
                    : `Issuance live · ${region.trancheCount} tranches`
                  : 'Issuance not live'}
              </Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  card: {
    marginBottom: 14,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.18)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'baseline',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  code: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 3,
  },
  collapsedSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: -8,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flex: 1,
    minWidth: 96,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,11,17,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  attentionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  attentionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPressed: {
    opacity: 0.7,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
