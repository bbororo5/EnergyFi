import { Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { HardDrive, Clock, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { OnboardingFrame } from '@/components/screens/onboarding/onboarding-frame';
import { appRoutes } from '@/lib/navigation/routes';

const features = [
  { icon: HardDrive, color: colors.accent, title: 'Hardware Verified', desc: 'SE chip signatures anchor session trust' },
  { icon: Clock, color: colors.primary, title: 'Settlement Gated', desc: 'Only payment-complete sessions reach chain' },
  { icon: ShieldCheck, color: colors.primary, title: 'Operational Context', desc: 'Region, station, and charger coverage disclosed' },
];

export default function TrustScreen() {
  return (
    <OnboardingFrame step={2} buttonTitle="Continue" onPress={() => router.push(appRoutes.onboardingInvest)}>
      <View style={styles.top}>
        <Text style={styles.heading}>Trust & Transparency</Text>
        <Text style={styles.subtitle}>EnergyFi shows hardware, settlement, and operational context before any investment decision.</Text>
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

        <Animated.View entering={FadeInDown.duration(420).delay(320)} style={styles.riskCard}>
          <View style={[styles.iconBox, { backgroundColor: colors.error }]}>
            <AlertCircle size={20} color={colors.white} strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Risk Disclosures</Text>
            <Text style={styles.riskDesc}>Investment execution stays off-app</Text>
          </View>
        </Animated.View>
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
  riskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
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
  riskDesc: {
    ...typography.label,
    color: '#FCA5A5',
  },
});
