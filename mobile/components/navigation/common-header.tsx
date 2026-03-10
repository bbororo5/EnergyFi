import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { Image } from 'expo-image';
import { brandAssets } from '@/constants/assets';
import { colors, typography, radius } from '@/constants/theme';
import { notifications } from '@/data/notifications';
import { NotificationPopover } from '@/components/navigation/notification-popover';

interface CommonHeaderProps {
  title?: string;
  onNotificationPress?: () => void;
  showNotificationBadge?: boolean;
  leftElement?: React.ReactNode;
}

export function CommonHeader({
  title = 'EnergyFi',
  onNotificationPress,
  showNotificationBadge = true,
  leftElement,
}: CommonHeaderProps) {
  const insets = useSafeAreaInsets();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const previewNotifications = useMemo(() => notifications.slice(0, 3), []);
  const unreadCount = useMemo(() => notifications.filter((item) => item.unread).length, []);

  const handleBellPress = () => {
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
        <Text style={styles.title}>{title}</Text>
      </View>
      {onNotificationPress ? (
        <View>
          <Pressable style={[styles.iconButton, isPopoverOpen && styles.iconButtonActive]} onPress={handleBellPress}>
            <Bell size={20} color={isPopoverOpen ? colors.sky400 : colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
          {showNotificationBadge ? <View style={styles.badge} /> : null}
          <NotificationPopover
            visible={isPopoverOpen}
            notifications={previewNotifications}
            unreadCount={unreadCount}
            top={insets.top + 62}
            right={20}
            onClose={() => setIsPopoverOpen(false)}
            onViewAll={handleViewAll}
          />
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
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary,
    letterSpacing: -0.3,
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
