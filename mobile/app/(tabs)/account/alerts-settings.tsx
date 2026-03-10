import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, DollarSign, Info, TrendingUp, AlertTriangle, Bell } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { SwitchToggle } from '@/components/ui/switch-toggle';

const alertTypes = [
  { key: 'dividendPayment', icon: DollarSign, color: colors.emerald400, label: 'Dividend Payment', sub: 'Receive payout confirmations' },
  { key: 'portfolioUpdates', icon: Info, color: colors.emerald400, label: 'Portfolio Updates', sub: 'Network expansion & milestones' },
  { key: 'performanceChanges', icon: TrendingUp, color: colors.indigo400, label: 'Performance Changes', sub: 'Significant yield variations' },
  { key: 'maintenanceAlerts', icon: AlertTriangle, color: colors.amber400, label: 'Maintenance Alerts', sub: 'Station repairs & status' },
  { key: 'newListings', icon: Bell, color: colors.fuchsia400, label: 'New Listings', sub: 'Be first to know about new tranches' },
] as const;

const channels = [
  { key: 'pushEnabled', label: 'Push Notifications', sub: 'In-app real-time alerts' },
  { key: 'emailEnabled', label: 'Email Alerts', sub: 'Detailed weekly summaries' },
  { key: 'smsEnabled', label: 'SMS Messages', sub: 'Critical security alerts' },
] as const;

type SettingsKey = typeof alertTypes[number]['key'] | typeof channels[number]['key'];

export default function AlertsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Record<SettingsKey, boolean>>({
    dividendPayment: true,
    portfolioUpdates: true,
    performanceChanges: true,
    maintenanceAlerts: false,
    newListings: true,
    pushEnabled: true,
    emailEnabled: false,
    smsEnabled: false,
  });

  const toggle = (key: SettingsKey) => setSettings((s) => ({ ...s, [key]: !s[key] }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Alerts & Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Alert Types */}
        <Text style={styles.sectionLabel}>ALERT TYPES</Text>
        <View style={styles.card}>
          {alertTypes.map((a, i) => (
            <View key={a.key}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: `${a.color}15` }]}>
                  <a.icon size={20} color={a.color} strokeWidth={2.2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{a.label}</Text>
                  <Text style={styles.rowSub}>{a.sub}</Text>
                </View>
                <SwitchToggle value={settings[a.key]} onValueChange={() => toggle(a.key)} />
              </View>
            </View>
          ))}
        </View>

        {/* Channels */}
        <Text style={styles.sectionLabel}>NOTIFICATION CHANNELS</Text>
        <View style={styles.card}>
          {channels.map((c, i) => (
            <View key={c.key}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.channelRow}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{c.label}</Text>
                  <Text style={styles.rowSub}>{c.sub}</Text>
                </View>
                <SwitchToggle value={settings[c.key]} onValueChange={() => toggle(c.key)} />
              </View>
            </View>
          ))}
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
});
