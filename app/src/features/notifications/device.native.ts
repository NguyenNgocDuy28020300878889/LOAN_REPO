import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';
import { env } from '@/lib/env';
import { runForCurrentAccount } from '@/lib/account-boundary';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import type { DevicePushState } from './device';

type Identity = { id: string; secret: string };
const key = `loan.push-device.${env.appEnv}`;
let identityPromise: Promise<Identity> | undefined;
let deviceQueue: Promise<unknown> = Promise.resolve();
function serializeDevice<T>(operation: () => Promise<T>): Promise<T> {
  const epoch = useAuthStore.getState().sessionEpoch;
  const next = deviceQueue
    .catch(() => undefined)
    .then(() => {
      if (useAuthStore.getState().sessionEpoch !== epoch) throw new Error('SESSION_CHANGED');
      return operation();
    });
  deviceQueue = next;
  return next;
}
async function getIdentity() {
  if (!identityPromise)
    identityPromise = (async () => {
      const stored = await SecureStore.getItemAsync(key);
      if (stored) return JSON.parse(stored) as Identity;
      const value = {
        id: Crypto.randomUUID(),
        secret: (Crypto.randomUUID() + Crypto.randomUUID()).replaceAll('-', ''),
      };
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return value;
    })().catch((error) => {
      identityPromise = undefined;
      throw error;
    });
  return identityPromise;
}

export function unregisterPushDevice() {
  return serializeDevice(unregisterDevice);
}
async function unregisterDevice() {
  if (!env.pushReady) return;
  await runForCurrentAccount(async (session) => {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) return;
    const identity = JSON.parse(stored) as Identity;
    const { error } = await getSupabaseClient()
      .rpc('unregister_push_device', {
        device_id_input: identity.id,
        secret_input: identity.secret,
      })
      .setHeader('Authorization', `Bearer ${session.access_token}`);
    if (error) throw error;
  });
}
export async function clearPushTray() {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.clearLastNotificationResponseAsync();
}

export function syncPushDevice(requestPermission = false): Promise<DevicePushState> {
  return serializeDevice(() => syncDevice(requestPermission));
}
async function syncDevice(requestPermission: boolean): Promise<DevicePushState> {
  if (!env.pushReady || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return 'unavailable';
  // Pin the account across permission UI, Expo token retrieval and database calls.
  return runForCurrentAccount(async (session) => {
    const epoch = useAuthStore.getState().sessionEpoch;
    const preferencesResult = await getSupabaseClient()
      .rpc('get_my_notification_preferences')
      .setHeader('Authorization', `Bearer ${session.access_token}`);
    if (preferencesResult.error) throw preferencesResult.error;
    if (useAuthStore.getState().sessionEpoch !== epoch) throw new Error('SESSION_CHANGED');
    const preferences = preferencesResult.data as { push_enabled: boolean };
    if (!preferences.push_enabled) {
      await unregisterDevice();
      await clearPushTray();
      return 'disabled';
    }
    const profile = await getSupabaseClient()
      .rpc('ensure_my_profile', { display_name_input: null, locale_input: null })
      .setHeader('Authorization', `Bearer ${session.access_token}`);
    if (profile.error) throw profile.error;
    const locale = (profile.data as { locale?: string })?.locale === 'vi' ? 'vi' : 'en';
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('loan-updates', {
        name: locale === 'vi' ? 'Cập nhật khoản vay' : 'Loan updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        sound: 'default',
      });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      if (useAuthStore.getState().sessionEpoch !== epoch) throw new Error('SESSION_CHANGED');
      await unregisterDevice();
      return permission.canAskAgain ? 'permissionNeeded' : 'blocked';
    }
    if (Platform.OS === 'android') {
      const channel = await Notifications.getNotificationChannelAsync('loan-updates');
      if (channel?.importance === Notifications.AndroidImportance.NONE) {
        if (useAuthStore.getState().sessionEpoch !== epoch) throw new Error('SESSION_CHANGED');
        await unregisterDevice();
        return 'blocked';
      }
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('PUSH_PROJECT_MISSING');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const identity = await getIdentity();
    if (useAuthStore.getState().sessionEpoch !== epoch) throw new Error('SESSION_CHANGED');
    // Use the original JWT even if the user changes account during the OS prompt.
    const { error } = await getSupabaseClient()
      .rpc('register_push_device', {
        device_id_input: identity.id,
        secret_input: identity.secret,
        token_input: token,
        platform_input: Platform.OS,
        timezone_input: getCalendars()[0]?.timeZone ?? 'UTC',
        locale_input: locale,
      })
      .setHeader('Authorization', `Bearer ${session.access_token}`);
    if (error) throw error;
    return 'ready';
  });
}
