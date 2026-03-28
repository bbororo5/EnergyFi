import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Zap, Activity, FileText, Shield, CheckCircle2,
} from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { SurfaceCard } from '@/components/ui/card';
import { faqItems } from '@/data/faq';

const revenueItems = [
  { label: 'Charging Fees', desc: 'Billing based on actual power consumed (kWh)' },
  { label: 'Time-of-Use', desc: 'Higher rates applied during peak hours' },
  { label: 'Operational Costs', desc: 'Net profit after electricity and maintenance' },
  { label: 'Monthly Dividends', desc: 'Profit distribution based on ownership stake' },
];

const stoInfo = [
  { label: 'LEGAL STATUS', value: 'FSC-Licensed Securities', color: colors.sky400 },
  { label: 'UNDERLYING ASSET', value: 'EV Charger Infrastructure', color: colors.indigo400 },
  { label: 'YIELD FLOW', value: 'Revenue → OPEX → Dividends', color: colors.emerald400 },
];

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to more options"
          accessibilityHint="Returns to the previous more options screen"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Learn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* What is EnergyFi */}
        <SurfaceCard style={styles.section}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(14,165,233,0.1)', borderColor: 'rgba(14,165,233,0.2)' }]}>
            <Zap size={24} color={colors.sky400} strokeWidth={2.2} />
          </View>
          <Text style={styles.sectionTitle}>What is EnergyFi?</Text>
          <Text style={styles.sectionDesc}>
            EnergyFi is an institutional-grade platform for investing in EV charging infrastructure through security tokens backed by real revenue.
          </Text>
        </SurfaceCard>

        {/* Revenue Model */}
        <SurfaceCard style={styles.section}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }]}>
            <Activity size={24} color={colors.emerald400} strokeWidth={2.2} />
          </View>
          <Text style={styles.sectionTitle}>Revenue Model</Text>
          <Text style={styles.sectionSubtitle}>How the ecosystem yields profit</Text>
          <View style={styles.revenueList}>
            {revenueItems.map((item) => (
              <View key={item.label} style={styles.revenueItem}>
                <CheckCircle2 size={16} color={colors.emerald400} strokeWidth={2.5} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.revenueLabel}>{item.label}</Text>
                  <Text style={styles.revenueDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {/* STO Structure */}
        <SurfaceCard style={styles.section}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }]}>
            <FileText size={24} color={colors.indigo400} strokeWidth={2.2} />
          </View>
          <Text style={styles.sectionTitle}>STO Structure</Text>
          <Text style={styles.sectionSubtitle}>Asset-backed revenue tokens</Text>
          <View style={styles.stoGrid}>
            {stoInfo.map((item) => (
              <View key={item.label} style={styles.stoCard}>
                <Text style={styles.stoLabel}>{item.label}</Text>
                <Text style={[styles.stoValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        {/* FAQ */}
        <Text style={styles.faqTitle}>FAQ</Text>
        <View style={styles.faqContainer}>
          {faqItems.map((item, index) => (
            <View key={index}>
              {index > 0 && <View style={styles.faqDivider} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.question}
                accessibilityHint={expandedFaq === index ? 'Collapses this answer' : 'Expands this answer'}
                style={styles.faqQuestion}
                onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
              >
                <Text style={[styles.faqQuestionText, expandedFaq === index && { color: colors.sky400 }]}>
                  {item.question}
                </Text>
                {expandedFaq === index ? (
                  <ChevronUp size={20} color={colors.sky400} strokeWidth={2.5} />
                ) : (
                  <ChevronDown size={20} color={colors.textMuted} strokeWidth={2.5} />
                )}
              </Pressable>
              {expandedFaq === index && (
                <View style={styles.faqAnswer}>
                  <View style={styles.faqAnswerCard}>
                    <Text style={styles.faqAnswerText}>{item.answer}</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Data Integrity */}
        <View style={styles.integrityCard}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(14,165,233,0.2)', borderColor: 'rgba(14,165,233,0.3)' }]}>
            <Shield size={24} color={colors.sky400} strokeWidth={2.2} />
          </View>
          <Text style={styles.sectionTitle}>Data Integrity</Text>
          <Text style={styles.integritySubtitle}>Triple-Verification Process</Text>
          <Text style={styles.integrityDesc}>
            All operational and financial data are verified through hardware attestation, blockchain recording, and independent auditing.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(9,11,17,0.8)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { ...typography.h4, color: colors.textPrimary, letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  section: { marginBottom: 0 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary, marginBottom: 6 },
  sectionSubtitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 16 },
  sectionDesc: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, lineHeight: 20 },
  revenueList: { gap: 12 },
  revenueItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  revenueLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  revenueDesc: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  stoGrid: { gap: 12 },
  stoCard: {
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  stoLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  stoValue: { fontSize: 14, fontWeight: '700' },
  faqTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  faqContainer: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  faqDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#CBD5E1', paddingRight: 8 },
  faqAnswer: { paddingHorizontal: 20, paddingBottom: 20 },
  faqAnswerCard: {
    backgroundColor: 'rgba(26,30,43,0.5)',
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  faqAnswerText: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 20 },
  integrityCard: {
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.2)',
  },
  integritySubtitle: { fontSize: 13, fontWeight: '700', color: '#7DD3FC', marginBottom: 8 },
  integrityDesc: { fontSize: 13, fontWeight: '600', color: 'rgba(125,211,252,0.7)', lineHeight: 20 },
});
