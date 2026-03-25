import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CommonHeader } from '@/components/navigation/common-header';
import { NotificationPopover } from '@/components/navigation/notification-popover';
import type { AnchorRect } from '@/components/navigation/anchored-popover';
import { colors } from '@/constants/theme';
import { useDemoNotifications } from '@/hooks/use-demo-notifications';

interface TabScreenLayoutProps {
  title: string;
  children: React.ReactNode;
  leftElement?: React.ReactNode;
}

export function TabScreenLayout({ title, children, leftElement }: TabScreenLayoutProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [bellAnchor, setBellAnchor] = useState<AnchorRect | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const { notifications, unreadCount } = useDemoNotifications();

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize((current) => (
      current.width === width && current.height === height ? current : { width, height }
    ));
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <CommonHeader
        title={title}
        leftElement={leftElement}
        showUserIdentity
        userDisplayName="Demo Investor"
        unreadCount={unreadCount}
        bellActive={isPopoverOpen}
        onBellPress={() => setIsPopoverOpen((prev) => !prev)}
        onMorePress={() => router.push('/portfolio/more')}
        onBellAnchorChange={setBellAnchor}
      />

      {children}

      <NotificationPopover
        visible={isPopoverOpen}
        notifications={notifications.slice(0, 3)}
        unreadCount={unreadCount}
        anchorRect={bellAnchor}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
        onClose={() => setIsPopoverOpen(false)}
        onViewAll={() => {
          setIsPopoverOpen(false);
          router.push('/portfolio/notifications');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
});
