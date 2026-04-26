import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppProvider } from './_appContext';

function NotificationNavigator() {
  const router = useRouter();
  useEffect(() => {
    // expo-notifications は web 非対応のためスキップ
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const animalId = data?.animalId;
      if (typeof animalId === 'string' && animalId) {
        router.push(`/animal/${animalId}`);
      }
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

function AppShell({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.webOuter}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <NotificationNavigator />
      <AppShell>
        <Stack>
          {/* 起動フロー — ヘッダーなし・バック不可 */}
          <Stack.Screen name="index"       options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="splash"      options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="onboarding"  options={{ headerShown: false, animation: 'fade' }} />

          {/* メインアプリ */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="animal/[id]"
            options={{ title: '動物詳細', headerBackTitle: '戻る', headerTintColor: '#F08080' }}
          />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen
            name="supabase-test"
            options={{ title: 'Supabase テスト', headerBackTitle: '戻る', headerTintColor: '#F08080' }}
          />
        </Stack>
      </AppShell>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: '#2D4A47',
    alignItems: 'center',
  },
  webInner: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
    // @ts-ignore — web only
    boxShadow: '0 0 40px rgba(0,0,0,0.25)',
  },
});
