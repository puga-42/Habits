// Side-effectful half of habit alerts: permissions + on-device scheduling of
// the pure plan from alerts.ts. Kept thin — everything decidable is decided in
// the planner, which is where the tests live.
//
// Like push.ts, `expo-notifications` is require()d lazily, never at module
// load, so environments without it (and Expo Go's module-load warnings) stay
// clean. All entry points swallow errors: a failed resync means stale or
// missing reminders, never a broken save path.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { planAlerts } from './alerts';
import { fetchHabits } from './habits';

type NotificationsModule = typeof import('expo-notifications');

// Tags our scheduled notifications so a resync cancels only habit alerts and
// never touches other pending local notifications.
export const ALERT_DATA_KIND = 'habit_alert';

function loadNotifications(): NotificationsModule | null {
  // Expo Go: requiring the module at all logs a WARN, and on Android an ERROR
  // (remote-push support was removed from Expo Go in SDK 53). Same gate as
  // push.ts — alerts need a development build; in Expo Go we skip cleanly.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

// Alerts should also show while the app is foregrounded (iOS hides local
// notifications in the foreground by default). Installed once per session.
let handlerInstalled = false;
function installPresentation(N: NotificationsModule): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    N.setNotificationChannelAsync('habit-alerts', {
      name: 'Habit alerts',
      importance: N.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

// Get-or-request notification permission. Called from the alerts editor when
// the user adds their first alert; background resyncs never prompt.
export async function ensureAlertPermissions(): Promise<boolean> {
  const N = loadNotifications();
  if (!N) return false;
  try {
    const settings = await N.getPermissionsAsync();
    if (settings.status === 'granted') {
      installPresentation(N);
      return true;
    }
    const req = await N.requestPermissionsAsync();
    if (req.status !== 'granted') return false;
    installPresentation(N);
    return true;
  } catch (err) {
    console.warn('alert permission request failed', err);
    return false;
  }
}

// Refill the on-device queue: cancel our pending alerts, then schedule the
// rolling-window plan. Fire-and-forget (mirrors syncWidgetData) — called after
// habit save/delete and once per session at sign-in. Skips silently when
// permission was never granted.
export function resyncHabitAlerts(ownerId: string): void {
  void (async () => {
    try {
      const N = loadNotifications();
      if (!N) return;
      const settings = await N.getPermissionsAsync();
      if (settings.status !== 'granted') return;
      installPresentation(N);

      const habits = await fetchHabits(ownerId);
      const plan = planAlerts(habits, new Date());

      const pending = await N.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending
          .filter((p) => p.content?.data?.kind === ALERT_DATA_KIND)
          .map((p) => N.cancelScheduledNotificationAsync(p.identifier)),
      );

      await Promise.all(
        plan.map((a) =>
          N.scheduleNotificationAsync({
            content: {
              title: a.title,
              body: a.body,
              data: { kind: ALERT_DATA_KIND, habitId: a.habitId },
            },
            trigger: {
              type: N.SchedulableTriggerInputTypes.DATE,
              date: a.fireDate,
            },
          }),
        ),
      );
    } catch (err) {
      console.warn('habit alert resync failed', err);
    }
  })();
}
