import { Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Activity, TrendingUp, ShieldCheck } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { OnboardingFrame } from '@/components/screens/onboarding/onboarding-frame';

const features = [
  { icon: Activity, color: colors.primary, title: 'Charging Activity', desc: 'See recently recorded charging sessions' },
  { icon: TrendingUp, color: colors.accent, title: 'Revenue Trends', desc: 'Read pending and finalized revenue history' },
  { icon: ShieldCheck, color: colors.primary, title: 'Settlement Proof', desc: 'Understand what is finalized on-chain' },
];

export default function FeaturesScreen() {
  return (
    <OnboardingFrame step={1} buttonTitle="Continue" onPress={() => router.push('/onboarding/trust')}>
      <View style={styles.top}>
        <Text style={styles.heading}>Live Network Evidence</Text>
        <Text style={styles.subtitle}>
          Follow charging activity, settlement proof, and revenue trends from direct contract reads.
        </Text>
      </View>

      <View style={styles.cards}>
        {features.map((feature, index) => (
          <Animated.View key={feature.title} entering={FadeInDown.duration(420).delay(index * 100)} style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: feature.color }]}>
              <feature.icon size={20} color={colors.white} strokeWidth={2} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{feature.title}</Text>
              <Text style={styles.cardDesc}>{feature.desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  top: {
    marginBottom: 32,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 320,
  },
  cards: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(21,25,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    paddingTop: 2,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
