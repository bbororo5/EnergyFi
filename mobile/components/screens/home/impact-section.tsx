import { View, Text, StyleSheet } from 'react-native';
import { Leaf, Wind, Zap } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { colors, radius, shadows } from '@/constants/theme';
import type { HomeImpactSummary } from '@/hooks/use-home-dashboard';

interface ImpactSectionProps {
  impact: HomeImpactSummary | null;
  isLoading?: boolean;
}

function formatKg(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')} kg`;
}

function formatEnergy(value: number) {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)} MWh`;
  }
  return `${value.toFixed(0)} kWh`;
}

export function ImpactSection({ impact, isLoading = false }: ImpactSectionProps) {
  const cards = impact
    ? [
        { icon: Wind, color: colors.emerald400, label: 'Estimated CO2 Avoided', value: formatKg(impact.estimatedCo2Kg) },
        { icon: Zap, color: colors.sky400, label: 'Recorded Energy', value: formatEnergy(impact.deliveredEnergyKwh) },
      ]
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>REAL-WORLD IMPACT</Text>
        <Badge label="ESTIMATED" variant="success" icon={Leaf} />
      </View>

      {isLoading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Calculating impact from recorded charging sessions...</Text>
        </View>
      ) : impact ? (
        <>
          <View style={styles.grid}>
            {cards.map((card) => (
              <View key={card.label} style={styles.card}>
                <card.icon size={20} color={card.color} strokeWidth={2} />
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.fullCard}>
            <Leaf size={20} color={colors.emerald400} strokeWidth={2} />
            <View style={styles.fullCardText}>
              <Text style={styles.cardLabel}>Tree-Year Equivalent</Text>
              <Text style={[styles.cardValue, { color: colors.emerald400 }]}>{impact.treeEquivalent.toLocaleString('ko-KR')} trees</Text>
              <Text style={styles.methodologyText}>{impact.methodologyLabel}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Impact metrics will appear after charging sessions are recorded on-chain.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    gap: 8,
    ...shadows.md,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    ...shadows.md,
  },
  fullCardText: {
    gap: 4,
    flex: 1,
  },
  methodologyText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
