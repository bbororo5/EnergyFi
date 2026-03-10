import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { brandAssets } from '@/constants/assets';
import { colors, typography, radius } from '@/constants/theme';
import { OnboardingFrame } from '@/components/screens/onboarding/onboarding-frame';

export default function WelcomeScreen() {
  return (
    <OnboardingFrame
      step={0}
      buttonTitle="Explore Dashboard"
      onPress={() => router.push('/onboarding/features')}
    >
      <Animated.View entering={FadeIn.duration(700)} style={styles.logoPill}>
        <Image source={brandAssets.logo} style={styles.logo} contentFit="contain" />
        <Text style={styles.logoPillText}>Demo surface</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(700).delay(120)} style={styles.hero}>
        <Text style={styles.heading}>
          Read the{'\n'}
          <Text style={styles.headingAccent}>Energy Grid</Text>
        </Text>
        <Text style={styles.subtitle}>Verified charging and revenue signals, presented clearly.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(700).delay(220)} style={styles.statementCard}>
        <Text style={styles.statementEyebrow}>Why EnergyFi</Text>
        <Text style={styles.statementTitle}>Proof with{'\n'}Context</Text>
        <Text style={styles.statementBody}>Review live charging activity, settlement history, and regional evidence from real EV infrastructure.</Text>
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  logoPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 28,
  },
  logo: {
    width: 24,
    height: 24,
  },
  logoPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  hero: {
    marginBottom: 28,
  },
  heading: {
    ...typography.h1,
    fontSize: 42,
    lineHeight: 46,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  headingAccent: {
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 280,
  },
  statementCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(16,23,38,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.12)',
  },
  statementEyebrow: {
    ...typography.micro,
    color: colors.sky400,
    marginBottom: 10,
  },
  statementTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  statementBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
