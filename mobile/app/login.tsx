import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, radius, shadows } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';

function AppleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={colors.surface}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();

  const handleLogin = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Sign in to EnergyFi</Text>
        <Text style={styles.subtitle}>Access the on-chain evidence desk</Text>
      </View>

      <View style={styles.buttons}>
        {/* Apple */}
        <Pressable
          style={({ pressed }) => [styles.authBtn, styles.appleBtn, pressed && styles.pressed]}
          onPress={handleLogin}
        >
          <AppleIcon />
          <Text style={styles.appleBtnText}>Continue with Apple</Text>
        </Pressable>

        {/* Google */}
        <Pressable
          style={({ pressed }) => [styles.authBtn, styles.googleBtn, pressed && styles.pressed]}
          onPress={handleLogin}
        >
          <GoogleIcon />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <Pressable
          style={({ pressed }) => [styles.authBtn, styles.emailBtn, pressed && styles.pressed]}
          onPress={handleLogin}
        >
          <Mail size={20} color={colors.textPrimary} strokeWidth={2} />
          <Text style={styles.emailBtnText}>Continue with Email</Text>
        </Pressable>
      </View>

      <View style={styles.guestSection}>
        <Pressable onPress={handleLogin}>
          <Text style={styles.guestText}>Browse Read-Only</Text>
        </Pressable>
        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service and Privacy Policy. EnergyFi does not execute securities transactions in-app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  heading: { fontSize: 32, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  subtitle: { ...typography.body, color: colors.textSecondary },
  buttons: { gap: 12 },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: radius.xl,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  appleBtn: {
    backgroundColor: colors.textPrimary,
    ...shadows.sm,
  },
  appleBtnText: { ...typography.button, color: colors.surface },
  googleBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  googleBtnText: { ...typography.button, color: colors.textPrimary },
  emailBtn: {
    backgroundColor: colors.surfaceSecondary,
  },
  emailBtnText: { ...typography.button, color: colors.textPrimary },
  divider: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.label, color: colors.textTertiary, paddingHorizontal: 16 },
  guestSection: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  guestText: { ...typography.bodyBold, color: colors.primary, marginBottom: 24 },
  disclaimer: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 16 },
});
