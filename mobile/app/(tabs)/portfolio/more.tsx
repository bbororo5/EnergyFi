import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Bell, Settings, BookOpen, HelpCircle, Mail, Phone,
  FileText, Shield, Info, Building2, Wallet, ChevronRight,
} from 'lucide-react-native';
import { SurfaceCard } from '@/components/ui/card';
import { colors, typography, radius } from '@/constants/theme';
import { appRoutes } from '@/lib/navigation/routes';

function MenuButton({
  icon,
  label,
  onPress,
  accessibilityHint,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
      onPress={onPress}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} style={{ marginRight: 4 }} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to portfolio"
          accessibilityHint="Returns to the main portfolio screen"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <ChevronLeft size={20} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>More</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text numberOfLines={1} style={styles.sectionLabel}>Preferences</Text>
        <SurfaceCard padded={false} style={styles.menuCard}>
          <MenuButton
            icon={<Bell size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Alert settings"
            accessibilityHint="Opens notification preferences and alert delivery options"
            onPress={() => router.push(appRoutes.portfolioAlertsSettings)}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<Settings size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Settings"
            accessibilityHint="Opens portfolio application settings"
            onPress={() => router.push(appRoutes.portfolioSettings)}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<BookOpen size={20} color={colors.textSecondary} strokeWidth={2} />}
            label="Learn"
            accessibilityHint="Opens the learning hub for portfolio and region concepts"
            onPress={() => router.push(appRoutes.portfolioLearn)}
          />
        </SurfaceCard>

        <Text numberOfLines={1} style={styles.sectionLabel}>Support and help</Text>
        <SurfaceCard padded={false} style={styles.menuCard}>
          <MenuButton
            icon={<HelpCircle size={20} color={colors.textSecondary} />}
            label="Help Center"
            accessibilityHint="Opens portfolio support guidance"
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<Mail size={20} color={colors.textSecondary} />}
            label="Contact Support"
            accessibilityHint="Opens support contact options"
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuButton
            icon={<Phone size={20} color={colors.textSecondary} />}
            label="1588-0000"
            accessibilityHint="Shows the partner support phone number"
            onPress={() => {}}
          />
        </SurfaceCard>

        <Text numberOfLines={1} style={styles.sectionLabel}>Legal</Text>
        <SurfaceCard padded={false} style={styles.menuCard}>
          {[
            { icon: FileText, label: 'Terms of Service', type: 'terms' },
            { icon: Shield, label: 'Privacy Policy', type: 'privacy' },
            { icon: Info, label: 'Risk Disclosures', type: 'risk' },
            { icon: Building2, label: 'Operator Information', type: 'operator' },
          ].map((item, index) => (
            <View key={item.type}>
              {index > 0 && <View style={styles.menuDivider} />}
              <MenuButton
                icon={<item.icon size={20} color={colors.textSecondary} />}
                label={item.label}
                accessibilityHint={`Opens the ${item.label.toLowerCase()} document`}
                onPress={() => router.push(appRoutes.portfolioDocument(item.type))}
              />
            </View>
          ))}
        </SurfaceCard>

        <SurfaceCard padded={false} style={styles.menuCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutLeft}>
              <Info size={20} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>About EnergyFi</Text>
            </View>
            <Text style={styles.version}>v1.2.0</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.demoModeCard}>
          <View style={styles.demoModeIcon}>
            <Wallet size={20} color={colors.sky400} strokeWidth={2.5} />
          </View>
          <View style={styles.demoModeTextWrap}>
            <Text style={styles.demoModeTitle}>Demo Mode</Text>
            <Text style={styles.demoModeText}>This view combines live RegionSTO balances with a demo partner payout timeline.</Text>
          </View>
        </SurfaceCard>

        <Text style={styles.disclaimer}>
          EnergyFi is a read-only transparency desk.{'\n'}
          Securities onboarding and payout execution happen through licensed partner securities.{'\n'}
          Security tokens are subject to market and regulatory risks.
        </Text>
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
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 4,
  },
  menuCard: {
    marginBottom: 8,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 12,
  },
  menuBtnPressed: {
    backgroundColor: 'rgba(14,165,233,0.1)',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  version: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  demoModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  demoModeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(14,165,233,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoModeTextWrap: {
    flex: 1,
  },
  demoModeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  demoModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: colors.textMuted,
  },
});
