import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  getNotificationPreferences,
  updateMyLocale,
  updateNotificationPreferences,
} from '@/features/preferences/api';
import { requestAccountDeletion } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    enabled: Boolean(session),
  });
  const update = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(['notification-preferences'], data),
  });
  const localeUpdate = useMutation({ mutationFn: updateMyLocale });
  const selectLanguage = (locale: 'en' | 'vi') => {
    void i18n.changeLanguage(locale);
    if (session) localeUpdate.mutate(locale);
  };
  const deletion = useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: () => Alert.alert(t('appName'), t('settings.deletionRequested')),
    onError: () => Alert.alert(t('appName'), t('auth.unavailable')),
  });
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('appName')}</Text>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.help}>{t('settings.help')}</Text>
        <View accessibilityRole="radiogroup" style={styles.languageGroup}>
          <Text style={styles.languageLabel}>{t('settings.language')}</Text>
          <View style={styles.languageOptions}>
            <LanguageOption
              active={i18n.language === 'vi'}
              label={t('settings.vietnamese')}
              onPress={() => selectLanguage('vi')}
            />
            <LanguageOption
              active={i18n.language !== 'vi'}
              label={t('settings.english')}
              onPress={() => selectLanguage('en')}
            />
          </View>
        </View>
        {!session ? (
          <View style={styles.signInCard}>
            <Text style={styles.help}>{t('settings.signInToManage')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/auth')}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>{t('auth.signIn')}</Text>
            </Pressable>
          </View>
        ) : preferences.isLoading || !preferences.data ? (
          preferences.isError ? (
            <View style={styles.signInCard}>
              <Text style={styles.help}>{t('settings.preferencesUnavailable')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void preferences.refetch()}
                style={styles.signInButton}
              >
                <Text style={styles.signInButtonText}>{t('settings.tryAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator color="#1D4ED8" style={styles.loader} />
          )
        ) : (
          <PreferenceControls
            deletionPending={deletion.isPending}
            onDelete={() =>
              Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountWarning'), [
                { text: t('loan.cancel'), style: 'cancel' },
                {
                  text: t('settings.deleteAccount'),
                  style: 'destructive',
                  onPress: () => deletion.mutate(),
                },
              ])
            }
            onUpdate={(next) => update.mutate(next)}
            updatePending={update.isPending}
            value={preferences.data}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function PreferenceControls({
  deletionPending,
  onDelete,
  onUpdate,
  updatePending,
  value,
}: {
  deletionPending: boolean;
  onDelete: () => void;
  onUpdate: (value: { due_reminders_enabled: boolean; push_enabled: boolean }) => void;
  updatePending: boolean;
  value: { due_reminders_enabled: boolean; push_enabled: boolean };
}) {
  const { t } = useTranslation();
  return (
    <>
      <Preference
        label={t('settings.push')}
        value={value.push_enabled}
        disabled={updatePending}
        onChange={(push_enabled) => onUpdate({ ...value, push_enabled })}
      />
      <Preference
        label={t('settings.dueReminders')}
        value={value.due_reminders_enabled}
        disabled={updatePending || !value.push_enabled}
        onChange={(due_reminders_enabled) => onUpdate({ ...value, due_reminders_enabled })}
      />
      <Pressable
        accessibilityRole="button"
        disabled={deletionPending}
        onPress={onDelete}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteText}>{t('settings.deleteAccount')}</Text>
      </Pressable>
    </>
  );
}

function LanguageOption({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.languageOption, active && styles.languageOptionActive]}
    >
      <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onChange}
        value={value}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { padding: 24, gap: 16 },
  loader: { marginTop: 48 },
  signInCard: { backgroundColor: '#FFFFFF', borderRadius: 16, gap: 16, padding: 24 },
  signInButton: {
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
  },
  signInButtonText: { color: '#FFFFFF', fontWeight: '700' },
  eyebrow: { color: '#1D4ED8', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#101828' },
  help: { color: '#667085', lineHeight: 21, marginBottom: 8 },
  languageGroup: { gap: 8 },
  languageLabel: { color: '#344054', fontWeight: '700' },
  languageOptions: { flexDirection: 'row', gap: 8 },
  languageOption: {
    alignItems: 'center',
    borderColor: '#D0D5DD',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  languageOptionActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  languageOptionText: { color: '#344054', fontWeight: '700' },
  languageOptionTextActive: { color: '#FFFFFF' },
  item: {
    minHeight: 64,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { color: '#101828', fontWeight: '600' },
  deleteButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B42318',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  deleteText: { color: '#B42318', fontWeight: '700' },
});
