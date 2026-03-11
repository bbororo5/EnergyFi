import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { radius, shadows } from '@/constants/theme';

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnchoredPopoverProps {
  visible: boolean;
  anchorRect: AnchorRect | null;
  containerWidth: number;
  containerHeight: number;
  onClose: () => void;
  children: React.ReactNode;
  preferredWidth?: number;
  horizontalMargin?: number;
  topOffset?: number;
  tailInset?: number;
}

export function AnchoredPopover({
  visible,
  anchorRect,
  containerWidth,
  containerHeight,
  onClose,
  children,
  preferredWidth = 320,
  horizontalMargin = 12,
  topOffset = 12,
  tailInset = 42,
}: AnchoredPopoverProps) {
  if (!visible || !anchorRect || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }

  const sheetWidth = Math.min(preferredWidth, containerWidth - horizontalMargin * 2);
  const anchorCenterX = anchorRect.x + anchorRect.width / 2;
  const idealLeft = anchorCenterX - sheetWidth + tailInset;
  const left = Math.min(
    Math.max(idealLeft, horizontalMargin),
    Math.max(horizontalMargin, containerWidth - sheetWidth - horizontalMargin),
  );
  const top = Math.max(anchorRect.y + anchorRect.height + topOffset, horizontalMargin);
  const maxHeight = Math.max(240, containerHeight - top - horizontalMargin);
  const anchorOffsetX = Math.max(32, Math.min(sheetWidth - 32, anchorCenterX - left));
  const tailSize = 14;
  const tailLeft = anchorOffsetX - tailSize / 2;
  const entryScale = 0.82;
  const centerX = sheetWidth / 2;
  const startTranslateX = (anchorOffsetX - centerX) * (1 - entryScale);
  const startTranslateY = -12;

  const popoverEnter = ZoomIn.duration(220).withInitialValues({
    opacity: 0,
    transform: [
      { translateX: startTranslateX },
      { translateY: startTranslateY },
      { scale: entryScale },
    ],
  });

  const popoverExit = ZoomOut.duration(150).withInitialValues({
    transform: [
      { translateX: 0 },
      { translateY: 0 },
      { scale: 1 },
    ],
  });

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdropFill} />
      </Pressable>

      <Animated.View
        entering={popoverEnter}
        exiting={popoverExit}
        style={[styles.sheet, { top, left, width: sheetWidth, maxHeight }]}
      >
        <View style={[styles.tail, { left: tailLeft }]} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  sheet: {
    position: 'absolute',
    borderRadius: radius['4xl'],
    backgroundColor: 'rgba(22,27,38,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    ...shadows.xl,
  },
  tail: {
    position: 'absolute',
    top: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(22,27,38,0.96)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '45deg' }],
  },
});
