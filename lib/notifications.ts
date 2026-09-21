import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'デフォルト',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('[Notifications] 通知許可が拒否されました');
    return false;
  }
  console.log('[Notifications] 通知許可を取得しました');
  return true;
}

type ScheduleOptions = {
  title: string;
  body: string;
  delaySeconds?: number; // 省略時は即時
  data?: Record<string, unknown>; // 通知タップ時に渡すデータ（例: { animalId: '...' }）
};

export async function scheduleLocalNotification({ title, body, delaySeconds = 1, data }: ScheduleOptions): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, ...(data ? { data } : {}) },
      trigger: delaySeconds <= 1
        ? null  // 即時
        : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, repeats: false },
    });
    console.log('[Notifications] スケジュール登録:', title);
  } catch (e) {
    console.error('[Notifications] スケジュール失敗:', e);
  }
}
