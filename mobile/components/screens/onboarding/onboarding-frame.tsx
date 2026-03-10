import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui/button';
import { colors, radius } from '@/constants/theme';

interface OnboardingFrameProps {
  step: number;
  children: React.ReactNode;
  buttonTitle: string;
  onPress: () => void;
}

export function OnboardingFrame({ step, children, buttonTitle, onPress }: OnboardingFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#070B11', '#0B0E14', '#111726']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={[styles.glow, styles.glowPrimary]} />
      <View style={[styles.glow, styles.glowSecondary]} />

      <View style={styles.content}>{children}</View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
          ))}
        </View>
        <Button title={buttonTitle} onPress={onPress} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowPrimary: {
    top: 92,
    right: -120,
    width: 280,
    height: 280,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  glowSecondary: {
    bottom: 110,
    left: -120,
    width: 240,
    height: 240,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  bottom: {
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 32,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
});
