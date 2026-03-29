import { useEffect, useState } from 'react';
import { LayoutChangeEvent, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Ellipsis, UserRound } from 'lucide-react-native';
import { Image } from 'expo-image';
import { brandAssets } from '@/constants/assets';
import { colors, typography, radius } from '@/constants/theme';
import type { AnchorRect } from '@/components/navigation/anchored-popover';
import { IconButton } from '@/components/ui/icon-button';

interface CommonHeaderProps {
  title?: string;
  leftElement?: React.ReactNode;
  onBellAnchorChange?: (rect: AnchorRect | null) => void;
  identity?: {
    label: string;
  } | null;
  actions?: {
    bell?: {
      onPress: () => void;
      unreadCount?: number;
      active?: boolean;
    };
    more?: {
      onPress: () => void;
    };
  };
}

export function CommonHeader({
  title = 'EnergyFi',
  leftElement,
  onBellAnchorChange,
  identity = null,
  actions,
}: CommonHeaderProps) {
  const insets = useSafeAreaInsets();
  const [actionsLayout, setActionsLayout] = useState<AnchorRect | null>(null);
  const [bellLayout, setBellLayout] = useState<AnchorRect | null>(null);
  const bellAction = actions?.bell;
  const moreAction = actions?.more;
  const unreadCount = bellAction?.unreadCount ?? 0;
  const bellActive = bellAction?.active ?? false;

  useEffect(() => {
    if (!actionsLayout || !bellLayout) {
      onBellAnchorChange?.(null);
      return;
    }

    onBellAnchorChange?.({
      x: actionsLayout.x + bellLayout.x,
      y: actionsLayout.y + bellLayout.y,
      width: bellLayout.width,
      height: bellLayout.height,
    });
  }, [actionsLayout, bellLayout, onBellAnchorChange]);

  const handleActionsLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setActionsLayout({ x, y, width, height });
  };

  const handleBellLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setBellLayout({ x, y, width, height });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        {leftElement ?? (
          <Image source={brandAssets.logo} style={styles.logo} contentFit="contain" />
        )}
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      {(identity || bellAction || moreAction) ? (
        <View testID="header-actions" style={styles.actions} onLayout={handleActionsLayout}>
          {identity ? (
            <View style={styles.userPill}>
              <UserRound size={14} color={colors.sky400} strokeWidth={2.2} />
              <Text
                numberOfLines={1}
                accessibilityRole="text"
                accessibilityLabel={`Signed in as ${identity.label}`}
                style={styles.userPillText}
              >
                {identity.label}
              </Text>
            </View>
          ) : null}

          {bellAction ? (
            <View testID="header-bell-anchor" onLayout={handleBellLayout} style={styles.notificationWrap}>
              <IconButton
                accessibilityLabel="Open notifications"
                accessibilityHint="Shows the latest EnergyFi updates and alerts"
                accessibilityState={{ expanded: bellActive }}
                onPress={bellAction.onPress}
                style={[styles.iconButton, bellActive && styles.iconButtonActive]}
                icon={<Bell size={20} color={bellActive ? colors.sky400 : colors.textSecondary} strokeWidth={2.2} />}
              />
              {unreadCount > 0 ? <View style={styles.badge} /> : null}
            </View>
          ) : null}

          {moreAction ? (
            <IconButton
              accessibilityLabel="Open more options"
              accessibilityHint="Shows preferences, support, and legal pages"
              onPress={moreAction.onPress}
              style={styles.iconButton}
              icon={<Ellipsis size={20} color={colors.textSecondary} strokeWidth={2.2} />}
            />
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
