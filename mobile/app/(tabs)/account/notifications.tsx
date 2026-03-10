import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle2, TrendingUp, Info } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { notifications, Notification } from '@/data/notifications';

const typeConfig = {
  success: { icon: CheckCircle2, bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', color: colors.emerald400 },
  alert: { icon: TrendingUp, bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)', color: colors.rose500 },
  info: { icon: Info, bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)', color: colors.sky400 },
};

function NotificationItem({ item }: { item: Notification }) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <View style={[styles.item, item.unread && styles.itemUnread]}>
      <View style={[styles.iconBox, { backgroundColor: config.bg, borderColor: config.border }]}>
        <Icon size={20} color={config.color} strokeWidth={2.2} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.itemTime}>{item.time}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
        {item.unread && (
          <View style={styles.unreadRow}>
            <View style={styles.unreadDot} />
            <Text style={styles.unreadText}>NEW UPDATE</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <X size={20} color={colors.textSecondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <NotificationItem item={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      />
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
  headerTitle: { ...typography.h3, color: colors.textPrimary, letterSpacing: -0.3 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { paddingHorizontal: 20, gap: 12 },
  item: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'rgba(22,27,38,0.4)',
    padding: 16,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  itemUnread: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, paddingRight: 8 },
  itemTime: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  itemMessage: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, lineHeight: 19 },
  unreadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  unreadText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
});
