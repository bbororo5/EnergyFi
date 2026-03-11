import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Zap } from 'lucide-react-native';
import { colors, radius, shadows } from '@/constants/theme';
import { Badge } from '@/components/ui/badge';
import type { LiveSession } from '@/hooks/use-live-network-data';

interface LiveFeedProps {
  sessions: LiveSession[];
}

export function LiveFeed({ sessions }: LiveFeedProps) {
  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>LIVE NETWORK REVENUE</Text>
          <Badge label="REAL-TIME" variant="live" dot />
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No charging sessions have been recorded on-chain yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>LIVE NETWORK REVENUE</Text>
        <Badge label="REAL-TIME" variant="live" dot />
      </View>
      {sessions.map((session, i) => (
        <Animated.View
          key={session.id}
          entering={i === 0 ? FadeIn.duration(400) : undefined}
          style={[
            styles.item,
            session.time === 'Just now' && styles.itemHighlight,
          ]}
        >
          <View style={styles.itemContent}>
            <View style={styles.itemTop}>
              <Text style={styles.station}>{session.station}</Text>
              <Text style={styles.revenue}>+₩{session.revenue.toLocaleString()}</Text>
            </View>
            <View style={styles.itemBottom}>
              <Text style={styles.meta}>{session.kwh} kWh · {session.time}</Text>
              <Badge
                label={session.deviceType.toUpperCase()}
                variant={session.deviceType === 'DC Fast' ? 'info' : 'success'}
                icon={Zap}
              />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
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
  item: {
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...shadows.md,
  },
  itemHighlight: {
    borderColor: 'rgba(16,185,129,0.2)',
    backgroundColor: 'rgba(16,185,129,0.05)',
  },
  itemContent: { flex: 1, gap: 8 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  station: { fontSize: 16, fontWeight: '800', color: colors.white },
  revenue: { fontSize: 16, fontWeight: '800', color: colors.white, fontVariant: ['tabular-nums'] },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  emptyCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...shadows.md,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
