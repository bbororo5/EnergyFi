import { Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ExternalLink } from 'lucide-react-native';
import { colors, typography } from '@/constants/theme';
import { OnboardingFrame } from '@/components/screens/onboarding/onboarding-frame';
import { appRoutes } from '@/lib/navigation/routes';

const steps = [
  { num: '1', color: colors.primary, title: 'Review Region Data', desc: 'Browse charging and revenue evidence in EnergyFi' },
  { num: '2', color: colors.accent, title: 'Complete KYC', desc: 'Open and verify a partner securities account' },
  { num: '3', color: colors.primary, title: 'Subscribe Off-App', desc: 'Transactions happen on the partner platform' },
];

export default function InvestScreen() {
  return (
    <OnboardingFrame step={3} buttonTitle="Continue to Login" onPress={() => router.replace(appRoutes.login)}>
      <View style={styles.iconBadge}>
        <ExternalLink size={30} color={colors.white} strokeWidth={2} />
      </View>

      <Text style={styles.heading}>Partner Securities Flow</Text>
      <Text style={styles.subtitle}>
        EnergyFi is the information layer. KYC, suitability, and subscription happen with a licensed securities partner.
      </Text>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <Animated.View key={step.num} entering={FadeInDown.duration(420).delay(index * 100)} style={styles.card}>
            <View style={[styles.numBadge, { backgroundColor: step.color }]}>
              <Text style={styles.numText}>{step.num}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardDesc}>{step.desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 6,
    marginBottom: 28,
  },
  steps: {
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
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  cardText: {
    flex: 1,
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
