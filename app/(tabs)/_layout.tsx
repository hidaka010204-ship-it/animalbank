import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../../lib/i18n';
import { useApp } from '../_appContext';

const THEME_ACTIVE_BG: Record<string, string> = {
  '#4FA3A0': '#D4EEE9',
  '#A8D8CF': '#DCF2EE',
  '#F08080': '#FFE4E4',
  '#F97316': '#FEE7D0',
};

function TabIcon({ emoji, focused, themeColor }: { emoji: string; focused: boolean; themeColor: string }) {
  const activeBg = THEME_ACTIVE_BG[themeColor] ?? '#D4EEE9';
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: activeBg }]}>
      <Text style={[styles.iconEmoji, focused && styles.iconEmojiActive]}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { themeColor, language } = useApp();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColor,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home', language),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} themeColor={themeColor} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t('tab_timeline', language),
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} themeColor={themeColor} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab_notifications', language),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} themeColor={themeColor} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('tab_animals', language),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏛️" focused={focused} themeColor={themeColor} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: t('tab_mypage', language),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} themeColor={themeColor} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 74,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: 'white',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  tabItem: {
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  iconWrap: {
    width: 46,
    height: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconEmoji: {
    fontSize: 22,
  },
  iconEmojiActive: {
    fontSize: 24,
  },
});
