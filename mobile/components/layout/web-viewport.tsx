import type { ReactNode } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

interface WebViewportProps {
  children: ReactNode;
}

export function WebViewport({ children }: WebViewportProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={styles.webContainer}>
      <View style={styles.webContent}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  webContent: {
    flex: 1,
    width: '100%',
    maxWidth: 480, // Natural constrained mobile web app width
    height: '100%' as any, // Ensure full height propagation on web
    backgroundColor: '#0B0E14', // Using colors.backgroundDeep
    overflow: 'hidden' as const,
  },
});
