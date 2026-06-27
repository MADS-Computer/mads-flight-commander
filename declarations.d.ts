// Module stubs for packages without type declarations in this project.

declare module 'expo-notifications' {
  export type NotificationPermissionsStatus = { status: 'granted' | 'denied' | 'undetermined' };
  export type ExpoPushToken = { data: string };
  export function getPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function requestPermissionsAsync(): Promise<NotificationPermissionsStatus>;
  export function getExpoPushTokenAsync(): Promise<ExpoPushToken>;
  export function setNotificationHandler(handler: {
    handleNotification: (n: unknown) => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;
  export function scheduleNotificationAsync(req: {
    content: { title: string; body: string; sound?: boolean };
    trigger: { seconds: number } | null;
  }): Promise<string>;
}
