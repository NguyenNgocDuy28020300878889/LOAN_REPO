import { Alert } from '@/lib/alert';
import { accountKey } from '@/lib/account-boundary';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getNotificationPreferences,
  updateMyLocale,
  updateNotificationPreferences,
} from '@/features/preferences/api';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';
import { usePushDevice } from '@/features/notifications/use-push-device';
import { syncPushDevice } from '@/features/notifications/device';
import { env } from '@/lib/env';
import {
  base,
  Button,
  Card,
  Icon,
  Label,
  Notice,
  PageHeader,
  Screen,
  Section,
  usePalette,
  selectionKeyProps,
} from '@/components/loan-ui';

export default function SettingsScreen() {
  const p = usePalette();
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const queryClient = useQueryClient();
  const pushDevice = usePushDevice();
  const enableDevice = useMutation({
    mutationFn: () => syncPushDevice(true),
    onSuccess: (data) =>
      queryClient.setQueryData(accountKey(session?.user.id, 'push-device'), data),
  });
  const logout = useMutation({
    mutationFn: signOut,
    onError: () => Alert.alert(t('appName'), t('auth.unavailable')),
  });
  const preferences = useQuery({
    queryKey: accountKey(session?.user.id, 'notification-preferences'),
    queryFn: getNotificationPreferences,
    enabled: Boolean(session),
  });
  const update = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(accountKey(session?.user.id, 'notification-preferences'), data);
      void queryClient.invalidateQueries({ queryKey: accountKey(session?.user.id, 'push-device') });
    },
  });
  const localeUpdate = useMutation({ mutationFn: updateMyLocale });
  const selectLanguage = (locale: 'en' | 'vi') => {
    void i18n.changeLanguage(locale);
    if (session) localeUpdate.mutate(locale);
  };
  return (
    <Screen>
      <PageHeader back={false} title={t('settings.title')} subtitle={t('ui.settingsSubtitle')} />
      <Card>
        <Section>{t('settings.language')}</Section>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('settings.language')}
          style={{ gap: 8 }}
        >
          {(['vi', 'en'] as const).map((locale) => (
            <Pressable
              key={locale}
              accessibilityRole="radio"
              {...selectionKeyProps(() => selectLanguage(locale))}
              aria-checked={i18n.language.startsWith(locale)}
              accessibilityState={{
                checked: i18n.language.startsWith(locale),
                selected: i18n.language.startsWith(locale),
              }}
              onPress={() => selectLanguage(locale)}
              style={({ pressed }) => [
                {
                  minHeight: 56,
                  borderWidth: 1,
                  borderRadius: 16,
                  borderColor: i18n.language.startsWith(locale) ? p.primary : p.border,
                  backgroundColor: i18n.language.startsWith(locale) ? p.soft : p.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[base.body, { color: p.text, flex: 1 }]}>
                {t(locale === 'vi' ? 'settings.vietnamese' : 'settings.english')}
              </Text>
              {i18n.language.startsWith(locale) && (
                <Icon name="check" size={20} color={p.primary} />
              )}
            </Pressable>
          ))}
        </View>
      </Card>
      {!session ? (
        <Card>
          <Label muted>{t('settings.signInToManage')}</Label>
          <Button label={t('auth.signIn')} onPress={() => router.push('/auth')} />
        </Card>
      ) : (
        <>
          <Card>
            <Section>{t('ui.notifications')}</Section>
            <Label muted>
              {t(env.pushReady ? 'settings.pushSchedule' : 'ui.notificationHint')}
            </Label>
            {env.pushReady && (
              <>
                <Label muted>{t(`settings.pushState.${pushDevice.data ?? 'checking'}`)}</Label>
                {(pushDevice.isError || enableDevice.isError) && (
                  <Notice tone="danger">{t('settings.pushSetupError')}</Notice>
                )}
                {(pushDevice.data === 'permissionNeeded' ||
                  pushDevice.isError ||
                  enableDevice.isError) && (
                  <Button
                    label={t('settings.enableDevice')}
                    loading={enableDevice.isPending}
                    onPress={() => enableDevice.mutate()}
                  />
                )}
                {pushDevice.data === 'blocked' && (
                  <Button
                    kind="secondary"
                    label={t('settings.openSystemSettings')}
                    onPress={() => {
                      void Linking.openSettings().catch(() => undefined);
                    }}
                  />
                )}
              </>
            )}
            {preferences.isLoading ? (
              <ActivityIndicator color={p.primary} />
            ) : preferences.isError || !preferences.data ? (
              <>
                <Notice tone="danger">{t('settings.preferencesUnavailable')}</Notice>
                <Button
                  kind="secondary"
                  label={t('settings.tryAgain')}
                  onPress={() => void preferences.refetch()}
                />
              </>
            ) : (
              <>
                <Preference
                  label={t('settings.push')}
                  value={preferences.data.push_enabled}
                  disabled={update.isPending}
                  onChange={(push_enabled) => update.mutate({ ...preferences.data!, push_enabled })}
                />
                <Preference
                  label={t('settings.dueReminders')}
                  value={preferences.data.due_reminders_enabled}
                  disabled={update.isPending || !preferences.data.push_enabled}
                  onChange={(due_reminders_enabled) =>
                    update.mutate({ ...preferences.data!, due_reminders_enabled })
                  }
                />
                {update.isError && <Notice tone="danger">{t('loan.somethingWentWrong')}</Notice>}
              </>
            )}
          </Card>
          <Card>
            <Section>{t('ui.account')}</Section>
            <Label muted>{session.user.email}</Label>
            <Button
              kind="secondary"
              label={t('auth.signOut')}
              loading={logout.isPending}
              onPress={() => logout.mutate()}
            />
          </Card>
        </>
      )}
      <Card>
        <Section>{t('settings.legal')}</Section>
        <Button
          kind="quiet"
          icon="document"
          label={t('settings.privacyPolicy')}
          onPress={() => router.push('/privacy-policy' as never)}
        />
        <Button
          kind="quiet"
          icon="document"
          label={t('settings.terms')}
          onPress={() => router.push('/terms' as never)}
        />
        <Button
          kind="quiet"
          label={t('settings.deleteAccount')}
          onPress={() => router.push('/account-deletion' as never)}
        />
      </Card>
      {localeUpdate.isError && <Notice tone="danger">{t('loan.somethingWentWrong')}</Notice>}
    </Screen>
  );
}
function Preference({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      {...selectionKeyProps(() => onChange(!value), disabled)}
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderTopWidth: 1,
        borderColor: p.border,
        paddingTop: 12,
      }}
    >
      <Text style={[base.body, { color: p.text, flex: 1 }]}>{label}</Text>
      <View
        accessible={false}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 44,
          height: 28,
          borderRadius: 16,
          padding: 4,
          backgroundColor: value ? p.primary : p.muted,
          alignItems: value ? 'flex-end' : 'flex-start',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 12,
            backgroundColor: value ? p.onPrimary : p.surface,
          }}
        />
      </View>
    </Pressable>
  );
}
