import { ActivityIndicator, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  Label,
  Notice,
  PageHeader,
  Screen,
  Section,
  usePalette,
} from '@/components/loan-ui';
import { accountKey } from '@/lib/account-boundary';
import {
  getAccountDeletionRequest,
  requestAccountDeletion,
  signOut,
  type AccountDeletionRequest,
} from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

function needsFreshSignIn(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'message' in error &&
    String(error.message).includes('REAUTHENTICATION_REQUIRED'),
  );
}

export default function AccountDeletionScreen() {
  const p = usePalette();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const queryKey = accountKey(session?.user.id, 'account-deletion');
  const deletion = useQuery({
    queryKey,
    queryFn: getAccountDeletionRequest,
    enabled: Boolean(session),
  });
  const request = useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  const reauthenticate = useMutation({
    mutationFn: signOut,
    onSuccess: () => router.replace('/auth?returnTo=%2Faccount-deletion'),
  });
  const current = (request.data ?? deletion.data) as AccountDeletionRequest | null | undefined;
  const active = current?.status === 'PENDING' || current?.status === 'PROCESSING';
  const requestError = request.error;

  return (
    <Screen>
      <PageHeader title={t('deletion.title')} subtitle={t('deletion.subtitle')} />
      {Platform.OS === 'web' && <Notice>{t('deletion.webResource')}</Notice>}
      <Card>
        <Section>{t('deletion.whatHappens')}</Section>
        <Label>{t('deletion.profileRemoved')}</Label>
        <Label>{t('deletion.sharedHistory')}</Label>
        <Label>{t('deletion.processingPending')}</Label>
      </Card>
      {!session ? (
        <Card>
          <Notice tone="warning">{t('deletion.signInRequired')}</Notice>
          <Button
            label={t('auth.signIn')}
            onPress={() => router.push('/auth?returnTo=%2Faccount-deletion')}
          />
        </Card>
      ) : deletion.isLoading ? (
        <ActivityIndicator color={p.primary} />
      ) : deletion.isError ? (
        <Card>
          <Notice tone="danger">{t('deletion.statusUnavailable')}</Notice>
          <Button
            kind="secondary"
            label={t('settings.tryAgain')}
            onPress={() => deletion.refetch()}
          />
        </Card>
      ) : (
        <Card>
          <Section>{t('deletion.request')}</Section>
          {current && (
            <Notice tone={current.status === 'FAILED' ? 'danger' : active ? 'warning' : undefined}>
              {t(`deletion.status.${current.status}`)}
            </Notice>
          )}
          <Label muted>{t('deletion.confirmation')}</Label>
          {requestError && !needsFreshSignIn(requestError) && (
            <Notice tone="danger">{t('deletion.requestFailed')}</Notice>
          )}
          {needsFreshSignIn(requestError) ? (
            <>
              <Notice tone="warning">{t('deletion.freshSignInRequired')}</Notice>
              <Button
                label={t('deletion.signInAgain')}
                loading={reauthenticate.isPending}
                onPress={() => reauthenticate.mutate()}
              />
            </>
          ) : (
            <Button
              kind="danger"
              label={t(active ? 'deletion.requestRecorded' : 'deletion.submit')}
              loading={request.isPending}
              disabled={active}
              onPress={() => request.mutate()}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
