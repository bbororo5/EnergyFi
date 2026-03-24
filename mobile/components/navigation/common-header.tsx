import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Ellipsis, UserRound } from 'lucide-react-native';
import { Image } from 'expo-image';
import { brandAssets } from '@/constants/assets';
import { colors, typography, radius } from '@/constants/theme';
import { NotificationPopover } from '@/components/navigation/notification-popover';
import { useDemoNotifications } from '@/hooks/use-demo-notifications';

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CommonHeaderProps {
  title?: string;
  onNotificationPress?: () => void;
  onMorePress?: () => void;
  showNotificationBadge?: boolean;
  showUserIdentity?: boolean;
  userDisplayName?: string;
  leftElement?: React.ReactNode;
}

export function CommonHeader({
  title = 'EnergyFi',
  onNotificationPress,
  onMorePress,
  showNotificationBadge = true,
  showUserIdentity = false,
  userDisplayName = 'Demo Investor',
  leftElement,
}: CommonHeaderProps) {
  const insets = useSafeAreaInsets();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [bellAnchor, setBellAnchor] = useState<AnchorRect | null>(null);
  const bellWrapRef = useRef<View | null>(null);
  const { notifications, unreadCount } = useDemoNotifications();
  const previewNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);

  const measureBellAnchor = () => {
    bellWrapRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setBellAnchor({ x, y, width, height });
      }
    });
  };

  const handleBellPress = () => {
    measureBellAnchor();
    setIsPopoverOpen((prev) => !prev);
  };

  const handleViewAll = () => {
    setIsPopoverOpen(false);
    onNotificationPress?.();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        {leftElement ?? (
          <Image source={brandAssets.logo} style={styles.logo} contentFit="contain" />
        )}
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      {(showUserIdentity || onNotificationPress || onMorePress) ? (
        <View style={styles.actions}>
          {showUserIdentity ? (
            <View style={styles.userPill}>
              <UserRound size={14} color={colors.sky400} strokeWidth={2.2} />
              <Text numberOfLines={1} style={styles.userPillText}>{userDisplayName}</Text>
            </View>
          ) : null}

          {onNotificationPress ? (
            <View
              ref={bellWrapRef}
              collapsable={false}
              onLayout={measureBellAnchor}
              style={styles.notificationWrap}
            >
              <Pressable style={[styles.iconButton, isPopoverOpen && styles.iconButtonActive]} onPress={handleBellPress}>
                <Bell size={20} color={isPopoverOpen ? colors.sky400 : colors.textSecondary} strokeWidth={2.2} />
              </Pressable>
              {showNotificationBadge && unreadCount > 0 ? <View style={styles.badge} /> : null}
              <NotificationPopover
                visible={isPopoverOpen}
                notifications={previewNotifications}
                unreadCount={unreadCount}
                anchorRect={bellAnchor}
                onClose={() => setIsPopoverOpen(false)}
                onViewAll={handleViewAll}
              />
            </View>
          ) : null}

          {onMorePress ? (
            <Pressable style={styles.iconButton} onPress={onMorePress}>
              <Ellipsis size={20} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.backgroundDeep,
    zIndex: 50,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationWrap: {
    position: 'relative',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 128,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  iconButtonActive: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderColor: 'rgba(14,165,233,0.3)',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emerald500,
    borderWidth: 2,
    borderColor: colors.backgroundDeep,
  },
});
