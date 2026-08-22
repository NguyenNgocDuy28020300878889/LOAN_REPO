import { getSupabaseClient } from '@/lib/supabase';

export type NotificationPreferences = { push_enabled: boolean; due_reminders_enabled: boolean };
export type SupportedLocale = 'en' | 'vi';

export async function getMyLocale(): Promise<SupportedLocale> {
  const { data, error } = await getSupabaseClient().rpc('ensure_my_profile', {
    display_name_input: null,
    locale_input: null,
  });
  if (error) throw error;
  return (data as { locale?: unknown } | null)?.locale === 'vi' ? 'vi' : 'en';
}

export async function updateMyLocale(locale: SupportedLocale): Promise<SupportedLocale> {
  const { data, error } = await getSupabaseClient().rpc('ensure_my_profile', {
    display_name_input: null,
    locale_input: locale,
  });
  if (error) throw error;
  return (data as { locale?: unknown } | null)?.locale === 'vi' ? 'vi' : 'en';
}

export async function getNotificationPreferences() {
  const { data, error } = await getSupabaseClient().rpc('get_my_notification_preferences');
  if (error) throw error;
  return data as NotificationPreferences;
}

export async function updateNotificationPreferences(preferences: NotificationPreferences) {
  const { data, error } = await getSupabaseClient().rpc('update_my_notification_preferences', {
    push_enabled_input: preferences.push_enabled,
    due_reminders_enabled_input: preferences.due_reminders_enabled,
  });
  if (error) throw error;
  return data as NotificationPreferences;
}
