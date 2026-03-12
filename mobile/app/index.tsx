import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { colors } from '@/constants/theme';
import { SplashAnimation } from '@/components/animated/splash-animation';
import { appRoutes } from '@/lib/navigation/routes';

export default function EntryScreen() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => null);
  }, []);

  const handleSplashComplete = () => {
    setSplashDone(true);
  };

  useEffect(() => {
    if (!splashDone) return;
    router.replace(appRoutes.tabs);
  }, [splashDone]);

  return (
    <View style={styles.container}>
      {!splashDone && <SplashAnimation onComplete={handleSplashComplete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
