import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { radius } from '@/constants/theme';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  height?: number;
}

export function FlipCard({ front, back, height = 260 }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const toggleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    rotation.value = withTiming(next ? 180 : 0, { duration: 700 });
  };

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: rotation.value < 90 ? 1 : 0,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [180, 360], Extrapolation.CLAMP);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      opacity: rotation.value >= 90 ? 1 : 0,
    };
  });

  return (
    <Pressable onPress={toggleFlip} style={[styles.container, { height }]}>
      <Animated.View style={[styles.face, { height }, frontStyle]}>
        {front}
      </Animated.View>
      <Animated.View style={[styles.face, styles.backFace, { height }, backStyle]}>
        {back}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  face: {
    position: 'absolute',
    width: '100%',
    borderRadius: radius['3xl'],
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    overflow: 'hidden',
  },
  backFace: {
    backgroundColor: 'rgba(22,27,38,0.6)',
  },
});
