import { Alert } from '@/lib/alert';
import { useState } from 'react';
import { Button, Card, Field, PageHeader, Screen } from '@/components/loan-ui';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { hasPasswordRecovery, updateRecoveredPassword } from '@/lib/auth';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  if (!hasPasswordRecovery()) return <Redirect href="/auth" />;
  const submit = async () => {
    if (password.length < 12 || password !== confirmation)
      return Alert.alert(t('appName'), t('auth.passwordRequirements'));
    setLoading(true);
    try {
      await updateRecoveredPassword(password);
      router.replace('/');
    } catch {
      Alert.alert(t('appName'), t('auth.unavailable'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen
      footer={
        <Button label={t('auth.savePassword')} loading={loading} onPress={() => void submit()} />
      }
    >
      <PageHeader title={t('auth.newPassword')} subtitle={t('ui.resetSubtitle')} />
      <Card>
        <Field
          label={t('auth.newPassword')}
          accessibilityLabel={t('auth.newPassword')}
          placeholder={t('auth.newPassword')}
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label={t('auth.confirmPassword')}
          accessibilityLabel={t('auth.confirmPassword')}
          placeholder={t('auth.confirmPassword')}
          secureTextEntry
          autoComplete="new-password"
          value={confirmation}
          onChangeText={setConfirmation}
          hint={t('auth.passwordRequirements')}
        />
      </Card>
    </Screen>
  );
}
