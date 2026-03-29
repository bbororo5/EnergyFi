import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock3, Info, TrendingUp } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { colors, radius, typography } from '@/constants/theme';
import type { Notification } from '@/data/notifications';
import { AnchoredPopover, type AnchorRect } from '@/components/navigation/anchored-popover';

interface NotificationPopoverProps {
  visible: boolean;
  notifications: Notification[];
  unreadCount: number;
  anchorRect: AnchorRect | null;
  containerWidth: number;
  containerHeight: number;
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
  anchorRect,
  containerWidth,
  containerHeight,
  onClose,
  onViewAll,
}: NotificationPopoverProps) {
  if (!visible || !anchorRect) {
    return null;
  }

  return (
    <AnchoredPopover
      visible={visible}
      anchorRect={anchorRect}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      onClose={onClose}
      placement="bottom-end"
    >
      <View style={styles.sheet}>
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
          <Button
            title="View All Updates"
            variant="ghost"
            onPress={onViewAll}
            accessibilityHint="Opens the full notifications inbox"
            style={styles.button}
          />
        ) : null}
      </View>
    </AnchoredPopover>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 32,
    padding: 20,
    backgroundColor: 'rgba(22,27,38,0.96)',
    minHeight: 180,
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
