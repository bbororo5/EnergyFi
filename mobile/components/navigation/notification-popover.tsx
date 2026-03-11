import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { CheckCircle2, Clock3, Info, TrendingUp } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { colors, radius, shadows, typography } from '@/constants/theme';
import type { Notification } from '@/data/notifications';

interface NotificationPopoverProps {
  visible: boolean;
  notifications: Notification[];
  unreadCount: number;
  top: number;
  right: number;
  onClose: () => void;
  onViewAll?: () => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle2,
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.2)',
    color: colors.emerald400,
  },
  alert: {
    icon: TrendingUp,
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
    color: colors.amber400,
  },
  info: {
    icon: Info,
    bg: 'rgba(14,165,233,0.1)',
    border: 'rgba(14,165,233,0.2)',
    color: colors.sky400,
  },
} as const;

export function NotificationPopover({
  visible,
  notifications,
  unreadCount,
  top,
  right,
  onClose,
  onViewAll,
}: NotificationPopoverProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdropFill} />
      </Pressable>

      <Animated.View
        entering={ZoomIn.duration(220)}
        exiting={ZoomOut.duration(150)}
        style={[styles.sheet, { top, right }]}
      >
        <View style={styles.tail} />
        <View style={styles.glow} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Notifications</Text>
          <Text style={styles.badge}>{unreadCount} NEW</Text>
        </View>

        <View style={styles.list}>
          {notifications.map((notification) => {
            const config = typeConfig[notification.type];
            const Icon = config.icon;

            return (
              <View key={notification.id} style={[styles.item, !notification.unread && styles.itemMuted]}>
                <View style={[styles.iconWrap, { backgroundColor: config.bg, borderColor: config.border }]}>
                  <Icon size={16} color={config.color} strokeWidth={2.2} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {notification.title}
                  </Text>
                  <Text style={styles.itemMessage} numberOfLines={2}>
                    {notification.message}
                  </Text>
                  <View style={styles.timeRow}>
                    <Clock3 size={11} color={colors.textMuted} strokeWidth={2.2} />
                    <Text style={styles.time}>{notification.time}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {onViewAll ? (
          <Button title="View All Updates" variant="ghost" onPress={onViewAll} style={styles.button} />
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  sheet: {
    position: 'absolute',
    width: 320,
    borderRadius: 32,
    padding: 20,
    backgroundColor: 'rgba(22,27,38,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    ...shadows.xl,
  },
  tail: {
    position: 'absolute',
    top: -7,
    right: 24,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(22,27,38,0.96)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '45deg' }],
  },
  glow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(14,165,233,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.emerald400,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  itemMuted: {
    opacity: 0.72,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  itemMessage: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: colors.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  time: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  button: {
    marginTop: 16,
  },
});
