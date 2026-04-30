import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushTokenForUser(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.status;
  }
  if (granted !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lumina-default', {
      name: 'Lumina',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      lightColor: '#C9A96E',
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    return token;
  } catch (e) {
    console.warn('expo push token failed', e);
    return null;
  }
}

export async function pingLastSeen(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId);
}
