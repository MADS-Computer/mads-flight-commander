// Push + local notification helpers.
// expo-notifications must be installed: npx expo install expo-notifications

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Drone } from '@/types/drone';

// ── Dynamic import guard (expo-notifications is native-only on web) ────────────

async function getNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

// ── Notification preferences (toggled from Settings) ──────────────────────────

export type NotifPrefs = {
  lowBattery:    boolean;
  droneError:    boolean;
  droneOffline:  boolean;
  missionDone:   boolean;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  lowBattery:   true,
  droneError:   true,
  droneOffline: true,
  missionDone:  true,
};

// ── Push registration ─────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  const N = await getNotifications();
  if (!N) return null;

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
    }),
  });

  const { status: existing } = await N.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const { data: token } = await N.getExpoPushTokenAsync();
    return token ?? null;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ push_token: token }).eq('id', user.id);
}

// ── Local notifications ───────────────────────────────────────────────────────

export async function sendLocalNotification(title: string, body: string) {
  const N = await getNotifications();
  if (!N) {
    // Web fallback via browser Notification API
    if (Platform.OS === 'web' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon.png' });
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') new Notification(title, { body, icon: '/icon.png' });
      }
    }
    return;
  }

  await N.scheduleNotificationAsync({
    content:   { title, body, sound: true },
    trigger:   null,
  });
}

export async function scheduleNotification(title: string, body: string, seconds: number) {
  const N = await getNotifications();
  if (!N) return;

  await N.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { seconds },
  });
}

// ── Drone alert helpers ───────────────────────────────────────────────────────

export function checkDroneAlerts(drone: Drone, prefs: NotifPrefs) {
  if (prefs.lowBattery && drone.batteryPercent != null && drone.batteryPercent < 20) {
    sendLocalNotification(
      `Low Battery — ${drone.name}`,
      `Battery at ${drone.batteryPercent}%. Drone may lose power soon.`,
    );
  }
  if (prefs.droneError && drone.status === 'error') {
    sendLocalNotification(
      `Drone Error — ${drone.name}`,
      'An error was detected. Check the drone immediately.',
    );
  }
}

// ── NotificationService — wire to Supabase Realtime ──────────────────────────
// Call once at app startup (after auth). Returns an unsubscribe function.

export function startNotificationService(prefs: NotifPrefs): () => void {
  const channel = supabase
    .channel('notif-service-drones')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'drones' },
      (payload) => {
        const drone = payload.new as Drone;
        checkDroneAlerts(drone, prefs);
      },
    )
    .subscribe();

  // Offline detection: if channel errors for > 30 s, fire alert
  let offlineTimer: ReturnType<typeof setTimeout> | null = null;

  const channelAny = channel as unknown as {
    on(event: string, cb: () => void): unknown;
  };
  channelAny.on?.('error', () => {
    if (!offlineTimer) {
      offlineTimer = setTimeout(() => {
        if (prefs.droneOffline) {
          sendLocalNotification(
            'Connection Lost',
            'Supabase Realtime disconnected. Drone status may be stale.',
          );
        }
        offlineTimer = null;
      }, 30_000);
    }
  });

  return () => {
    if (offlineTimer) clearTimeout(offlineTimer);
    supabase.removeChannel(channel);
  };
}
