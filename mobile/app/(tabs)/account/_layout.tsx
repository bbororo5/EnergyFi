import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function AccountLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="more" />
      <Stack.Screen name="payout-history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="alerts-settings" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="learn" />
      <Stack.Screen name="document" />
    </Stack>
  );
}
