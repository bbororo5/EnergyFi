import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Grid2x2 as GridIcon, Layers, Activity, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

const TAB_BAR_HEIGHT = 70;
const TAB_BAR_HEIGHT_WEB = 92;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const baseHeight = Platform.OS === 'web' ? TAB_BAR_HEIGHT_WEB : TAB_BAR_HEIGHT;
  const bottomPadding = insets.bottom > 0 ? insets.bottom : Platform.OS === 'web' ? 24 : 12;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: baseHeight + insets.bottom,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <GridIcon size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Layers size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Activity size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <User size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(11, 14, 20, 0.9)',
    borderTopWidth: 0,
    paddingTop: 10,
    elevation: 0,
  },
  tabLabel: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  tabItem: {
    paddingTop: 2,
  },
  activeIconWrap: {
    position: 'relative',
  },
});
