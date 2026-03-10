import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Bell, Settings, Building2, ExternalLink, HelpCircle, Mail, Phone,
  FileText, Shield, Info, LogOut, ChevronRight, BookOpen,
} from 'lucide-react-native';
import { colors, typography, radius, shadows } from '@/constants/theme';
import { CommonHeader } from '@/components/navigation/common-header';

function MenuButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: 'rgba(14,165,233,0.1)' }]} onPress={onPress}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} style={{ marginRight: 4 }} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <CommonHeader
        title="Account"
        onNotificationPress={() => router.push('/(tabs)/account/notifications')}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarBox}>
              <User size={32} color={colors.sky400} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.profileName}>Demo Viewer</Text>
              <Text style={styles.profileEmail}>read-only@energyfi.demo</Text>
            </View>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>7</Text>
              <Text style={styles.statLabel}>REGIONS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Read-only</Text>
              <Text style={styles.statLabel}>ACCESS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.sky400 }]}>On-chain</Text>
              <Text style={styles.statLabel}>DATA</Text>
            </View>
          </View>
        </View>

        {/* Account & Preferences */}
        <Text style={styles.sectionLabel}>ACCOUNT & PREFERENCES</Text>
        <View style={styles.menuCard}>
          <MenuButton
            icon={<Bell size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Alerts & Notifications"
            onPress={() => router.push('/(tabs)/account/alerts-settings')}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<Settings size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Settings"
            onPress={() => router.push('/(tabs)/account/settings')}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<BookOpen size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Learn"
            onPress={() => router.push('/(tabs)/account/learn')}
          />
        </View>

        {/* Investment Access */}
        <Text style={styles.sectionLabel}>PARTNER ACCESS</Text>
        <View style={styles.investCard}>
          <View style={styles.investIconBox}>
            <Building2 size={24} color={colors.emerald400} strokeWidth={2} />
          </View>
          <Text style={styles.investTitle}>Partner Securities Guidance</Text>
          <Text style={styles.investSub}>EnergyFi explains the data. KYC and subscription happen on the partner platform.</Text>
          <View style={styles.investSteps}>
            {[
              'Review region evidence and risk disclosures in EnergyFi',
              'Open and verify a partner securities account',
              'Complete suitability review and subscribe on the partner platform',
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>
          <Pressable style={({ pressed }) => [styles.investBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
            <ExternalLink size={16} color={colors.black} strokeWidth={2.5} />
            <Text style={styles.investBtnText}>View Partner Flow</Text>
          </Pressable>
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>SUPPORT & HELP</Text>
        <View style={styles.menuCard}>
          <MenuButton icon={<HelpCircle size={20} color={colors.textSecondary} />} label="Help Center" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuButton icon={<Mail size={20} color={colors.textSecondary} />} label="Contact Support" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuButton icon={<Phone size={20} color={colors.textSecondary} />} label="1588-0000" onPress={() => {}} />
        </View>

        {/* Legal */}
        <Text style={styles.sectionLabel}>LEGAL & DISCLOSURES</Text>
        <View style={styles.menuCard}>
          {[
            { icon: FileText, label: 'Terms of Service', type: 'terms' },
            { icon: Shield, label: 'Privacy Policy', type: 'privacy' },
            { icon: Info, label: 'Risk Disclosures', type: 'risk' },
            { icon: Building2, label: 'Operator Information', type: 'operator' },
          ].map((item, i) => (
            <View key={item.type}>
              {i > 0 && <View style={styles.menuDivider} />}
              <MenuButton
                icon={<item.icon size={20} color={colors.textSecondary} />}
                label={item.label}
                onPress={() => router.push({ pathname: '/(tabs)/account/document', params: { type: item.type } })}
              />
            </View>
          ))}
        </View>

        {/* About */}
        <View style={styles.menuCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutLeft}>
              <Info size={20} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>About EnergyFi</Text>
            </View>
            <Text style={styles.version}>v1.2.0</Text>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable style={({ pressed }) => [styles.signOutCard, pressed && { backgroundColor: 'rgba(239,68,68,0.05)' }]}>
          <View style={styles.signOutIcon}>
            <LogOut size={20} color={colors.red500} strokeWidth={2.5} />
          </View>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          EnergyFi is a read-only transparency desk.{'\n'}
          Securities onboarding and transactions happen through licensed partner securities.{'\n'}
          Security tokens are subject to market and regulatory risks.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDeep },
  scroll: { paddingHorizontal: 20, gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 16,
    marginBottom: 4,
  },
  // Profile
  profileCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: { ...typography.h4, color: colors.textPrimary, letterSpacing: -0.3 },
  profileEmail: { ...typography.label, color: colors.textMuted, marginTop: 2 },
  profileDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 16 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  // Menu
  menuCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    ...shadows.md,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  // Investment
  investCard: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  investIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#2A3143',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  investTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
  investSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 16 },
  investSteps: { gap: 12, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: { fontSize: 10, fontWeight: '700', color: colors.emerald400 },
  stepText: { fontSize: 12, fontWeight: '600', color: '#CBD5E1', flex: 1 },
  investBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald500,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadows.glowEmerald,
  },
  investBtnText: { fontSize: 15, fontWeight: '700', color: colors.black },
  // About
  aboutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  aboutLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  version: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  // Sign Out
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['3xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    gap: 14,
    marginTop: 8,
  },
  signOutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.red500 },
  disclaimer: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 24,
    lineHeight: 18,
  },
});
