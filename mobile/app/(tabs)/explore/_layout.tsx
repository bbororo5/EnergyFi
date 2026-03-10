import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function ExploreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
