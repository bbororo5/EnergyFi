import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/constants/theme';
import { WebViewport } from '@/components/layout/web-viewport';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createAppQueryClient } from '@/lib/query-client';
import 'react-native-reanimated';

ExpoSplashScreen.preventAutoHideAsync().catch(() => null);

const queryClient = createAppQueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <WebViewport>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="admin/oracle" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="region/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            </Stack>
            <StatusBar style="light" />
          </WebViewport>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
