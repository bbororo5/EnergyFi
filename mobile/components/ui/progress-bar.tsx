import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/constants/theme';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({ value, color = colors.primary, height = 6, style }: ProgressBarProps) {
  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${Math.min(100, Math.max(0, value))}%` as any, { duration: 600 }),
  }));

  return (
    <View style={[styles.track, { height }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, height }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.full,
  },
});
