import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CommonHeader } from '@/components/navigation/common-header';
import { NotificationPopover } from '@/components/navigation/notification-popover';
import type { AnchorRect } from '@/components/navigation/anchored-popover';
import { colors } from '@/constants/theme';
import { useDemoNotifications } from '@/hooks/use-demo-notifications';
import { appRoutes } from '@/lib/navigation/routes';

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
    <View testID="tab-screen-layout-root" style={styles.container} onLayout={handleLayout}>
      <CommonHeader
        title={title}
        leftElement={leftElement}
        onBellAnchorChange={setBellAnchor}
        identity={{ label: 'Demo Investor' }}
        actions={{
          bell: {
            onPress: () => setIsPopoverOpen((prev) => !prev),
            unreadCount,
            active: isPopoverOpen,
          },
          more: {
            onPress: () => router.push(appRoutes.portfolioMore),
          },
        }}
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
          router.push(appRoutes.portfolioNotifications);
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
