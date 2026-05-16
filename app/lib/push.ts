// Expo push token registration. Called once per session, after sign-in.
// The token is upserted into `expo_push_tokens` so the notify-on-engagement
// Edge Function can look it up by `user_id` when a like/comment fires.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Expo Go since SDK 53 does not support remote push tokens. Importing
// `expo-notifications` at module-load time also prints warnings in Expo Go
// regardless of whether the module is used — so we gate on environment +
// EAS projectId BEFORE the import, and only require() the module when we
// actually intend to register.
function resolveProjectId(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas =
    (Constants.expoConfig as unknown as { eas?: { projectId?: string } })?.eas
      ?.projectId;
  return (fromExtra as string) ?? fromEas ?? null;
}

export async function registerPushToken(userId: string): Promise<void> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    // Running in Expo Go — push tokens aren't supported here.
    return;
  }
  const projectId = resolveProjectId();
  if (!projectId) {
    // Dev build without an EAS projectId set yet. Skip cleanly.
    return;
  }
  try {
    // Lazy require so Expo Go doesn't even load the module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResponse?.data;
    if (!token) return;

    await supabase
      .from('expo_push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
        },
        { onConflict: 'user_id,token' },
      );
  } catch (err) {
    console.warn('push token registration failed', err);
  }
}
