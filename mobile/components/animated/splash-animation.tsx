import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
} from 'react-native-reanimated';
import { brandAssets } from '@/constants/assets';
import { colors } from '@/constants/theme';

interface SplashAnimationProps {
  onComplete: () => void;
}

export function SplashAnimation({ onComplete }: SplashAnimationProps) {
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(10);
  const lineWidth = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // Logo reveal
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 1200 }));
    logoScale.value = withDelay(300, withTiming(1, { duration: 1200 }));

    // Text
    textOpacity.value = withDelay(800, withTiming(1, { duration: 800 }));
    textY.value = withDelay(800, withTiming(0, { duration: 800 }));

    // Line
    lineWidth.value = withDelay(1200, withTiming(40, { duration: 1000 }));

    // Fade out
    containerOpacity.value = withDelay(2200, withTiming(0, { duration: 800 }));

    // Complete
    const timer = setTimeout(() => onComplete(), 3000);
    return () => clearTimeout(timer);
  }, [containerOpacity, lineWidth, logoOpacity, logoScale, onComplete, textOpacity, textY]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={brandAssets.logo} style={styles.logo} contentFit="contain" />
      </Animated.View>

      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={styles.title}>ENERGYFI</Text>
        <Animated.View style={[styles.line, lineStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logoWrap: {
    width: 128,
    height: 128,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  line: {
    height: 1,
    backgroundColor: 'rgba(14,165,233,0.5)',
    marginTop: 8,
  },
});
