import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin, BarChart3, Shield, Grid3X3, ChevronRight } from 'lucide-react-native';
import { colors, radius, shadows } from '@/constants/theme';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import type { Portfolio } from '@/data/portfolios';

interface Props {
  portfolio: Portfolio;
  onPress: () => void;
}

export function PortfolioListItem({ portfolio: p, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconDot}>
            <MapPin size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{p.subtitle}</Text>
          </View>
        </View>
        <Badge
          label={p.status}
          variant={p.status === 'Live' ? 'live' : 'upcoming'}
          dot
        />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Stations</Text>
          <Text style={styles.metricValue}>{p.chargers}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Utilization</Text>
          <Text style={styles.metricValue}>{p.utilization}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Tokens</Text>
          <Text style={styles.metricValue}>{p.tokensMinted}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        <View style={styles.barRow}>
          <View style={styles.barLabel}>
            <BarChart3 size={12} color={colors.sky400} />
            <Text style={styles.barText}>Demand</Text>
          </View>
          <View style={styles.barTrack}>
            <ProgressBar value={p.demandStrength} color={colors.sky400} height={4} />
          </View>
        </View>
        <View style={styles.barRow}>
          <View style={styles.barLabel}>
            <Shield size={12} color={colors.emerald400} />
            <Text style={styles.barText}>Stability</Text>
          </View>
          <View style={styles.barTrack}>
            <ProgressBar value={p.stability} color={colors.emerald400} height={4} />
          </View>
        </View>
        <View style={styles.barRow}>
          <View style={styles.barLabel}>
            <Grid3X3 size={12} color={colors.indigo400} />
            <Text style={styles.barText}>Site Mix</Text>
          </View>
          <View style={styles.barTrack}>
            <ProgressBar value={p.diversification} color={colors.indigo400} height={4} />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>Regional snapshot</Text>
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.05)',
    padding: 20,
    marginBottom: 12,
    ...shadows.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  iconDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(14,165,233,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  metric: { flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] },
  bars: { gap: 10, marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 80 },
  barText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  barTrack: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerNote: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
});
