import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Globe, Moon, Sun, DollarSign, Lock, Smartphone, Eye } from 'lucide-react-native';
import { colors, typography, radius } from '@/constants/theme';
import { SwitchToggle } from '@/components/ui/switch-toggle';
import { PickerModal } from '@/components/ui/picker-modal';

const languages = [
  { label: 'English', value: 'en' },
  { label: 'Korean', value: 'ko' },
];

const currencies = [
  { label: '$ USD', value: 'USD' },
  { label: '₩ KRW', value: 'KRW' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState({
    language: 'en',
    darkMode: true,
    currency: 'USD',
    biometric: true,
    faceId: false,
  });
  const [langPicker, setLangPicker] = useState(false);
  const [currencyPicker, setCurrencyPicker] = useState(false);

  const toggle = (key: 'darkMode' | 'biometric' | 'faceId') =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  return (
    <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Display & Theme */}
        <Text numberOfLines={1} style={styles.sectionLabel}>Display and theme</Text>
        <View style={styles.card}>
          {/* Language */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change language"
            accessibilityHint="Opens the language picker"
            style={styles.row}
            onPress={() => setLangPicker(true)}
          >
            <View style={styles.iconBox}>
              <Globe size={20} color={colors.sky400} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Language</Text>
              <Text style={styles.rowSub}>Application UI language</Text>
            </View>
            <Text style={styles.valueText}>{languages.find((l) => l.value === settings.language)?.label}</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Dark Mode */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              {settings.darkMode
                ? <Moon size={20} color={colors.indigo400} strokeWidth={2} />
                : <Sun size={20} color={colors.amber500} strokeWidth={2} />}
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{settings.darkMode ? 'Dark Mode' : 'Light Mode'}</Text>
              <Text style={styles.rowSub}>Toggle visual theme</Text>
            </View>
            <SwitchToggle value={settings.darkMode} onValueChange={() => toggle('darkMode')} activeColor={colors.primary} />
          </View>

          <View style={styles.divider} />

          {/* Currency */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change currency"
            accessibilityHint="Opens the currency picker"
            style={styles.row}
            onPress={() => setCurrencyPicker(true)}
          >
            <View style={styles.iconBox}>
              <DollarSign size={20} color={colors.emerald400} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Currency</Text>
              <Text style={styles.rowSub}>Default money display</Text>
            </View>
            <Text style={[styles.valueText, { color: colors.emerald400 }]}>
              {currencies.find((c) => c.value === settings.currency)?.label}
            </Text>
          </Pressable>
        </View>

        {/* Security */}
        <Text numberOfLines={1} style={styles.sectionLabel}>Security</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change password"
            accessibilityHint="Opens the password update flow"
            style={styles.row}
          >
            <View style={styles.iconBox}>
              <Lock size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Change Password</Text>
              <Text style={styles.rowSub}>Update access credentials</Text>
            </View>
            <ChevronRight size={20} color={'rgba(255,255,255,0.2)'} strokeWidth={2} />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Smartphone size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Biometric Login</Text>
              <Text style={styles.rowSub}>Use fingerprint or FaceID</Text>
            </View>
            <SwitchToggle value={settings.biometric} onValueChange={() => toggle('biometric')} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Eye size={20} color={colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Face ID</Text>
              <Text style={styles.rowSub}>Quick access biometric</Text>
            </View>
            <SwitchToggle value={settings.faceId} onValueChange={() => toggle('faceId')} />
          </View>
        </View>

        {/* Data & Privacy */}
        <Text numberOfLines={1} style={styles.sectionLabel}>Data and privacy</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear cache"
            accessibilityHint="Clears temporary portfolio data stored on this device"
            style={styles.privacyRow}
          >
            <Text style={styles.rowLabel}>Clear Cache</Text>
            <Text style={styles.rowSub}>Temporary data storage - 142 MB</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Download my data"
            accessibilityHint="Requests an export of your EnergyFi data"
            style={styles.privacyRow}
          >
            <Text style={styles.rowLabel}>Download My Data</Text>
            <Text style={styles.rowSub}>Request full data export (GDPR)</Text>
          </Pressable>
        </View>

        {/* App Version */}
        <View style={styles.card}>
          <View style={styles.versionRow}>
            <View style={styles.versionLeft}>
              <Smartphone size={20} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>App Version</Text>
            </View>
            <Text style={styles.versionText}>v1.2.0</Text>
          </View>
        </View>
      </ScrollView>

      <PickerModal
        visible={langPicker}
        title="Select Language"
        options={languages}
        selected={settings.language}
        onSelect={(v) => setSettings((s) => ({ ...s, language: v }))}
        onClose={() => setLangPicker(false)}
      />
      <PickerModal
        visible={currencyPicker}
        title="Select Currency"
        options={currencies}
        selected={settings.currency}
        onSelect={(v) => setSettings((s) => ({ ...s, currency: v }))}
        onClose={() => setCurrencyPicker(false)}
      />
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
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: 'rgba(22,27,38,0.4)',
    borderRadius: radius['4xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  valueText: { fontSize: 14, fontWeight: '700', color: colors.sky400 },
  privacyRow: { padding: 20 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  versionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  versionText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
});
