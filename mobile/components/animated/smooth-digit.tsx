import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring
} from 'react-native-reanimated';

interface SmoothDigitProps {
  value: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
}

export function SmoothDigit({ value, prefix = '₩', suffix = '', fontSize = 40 }: SmoothDigitProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentValueRef = useRef(value);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Smooth number counting logic when value changes
    let startTimestamp: number | null = null;
    const duration = 1200; // 1.2 seconds to count up
    const startValue = currentValueRef.current;
    const endValue = value;

    if (startValue === endValue) return;

    // Add a slight bounce scale effect to emphasize the change
    scale.value = withSequence(
      withSpring(1.05, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function (easeOutExpo) for a natural deceleration
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      const currentValue = Math.floor(startValue + (endValue - startValue) * easeProgress);
      currentValueRef.current = currentValue;
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        currentValueRef.current = endValue;
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(step);
  }, [scale, value]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatted = `${prefix}${displayValue.toLocaleString('ko-KR')}${suffix}`;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Text style={[styles.text, { fontSize }]}>
        {formatted}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  text: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
});
