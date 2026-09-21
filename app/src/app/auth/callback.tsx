import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Brand, Button, Notice, Screen, usePalette } from '@/components/loan-ui';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { completeAuthCallback } from '@/lib/auth';

export default function AuthCallbackScreen() {
  const p = usePalette();
  const url = Linking.useURL();
  const router = useRouter();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setFailed(true);
    }, 15_000);
    if (url)
      void completeAuthCallback(url)
        .then((result) => {
          if (active) router.replace((result.recovery ? '/auth/reset' : result.returnTo) as never);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [url, router]);
  return (
    <Screen>
      <Brand />
      {failed ? (
        <>
          <Notice tone="danger">{t('auth.callbackFailed')}</Notice>
          <Button label={t('auth.signIn')} onPress={() => router.replace('/auth')} />
        </>
      ) : (
        <ActivityIndicator color={p.primary} accessibilityLabel={t('ui.loading')} />
      )}
    </Screen>
  );
}
