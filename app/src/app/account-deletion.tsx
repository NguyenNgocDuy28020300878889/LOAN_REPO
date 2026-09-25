import { ActivityIndicator, Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/lib/alert';

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
import { deleteAccount, getAccountDeletionState, signOut } from '@/lib/auth';
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
    queryFn: getAccountDeletionState,
    enabled: Boolean(session),
  });
  const request = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
      Alert.alert(t('appName'), t('deletion.completed'));
      router.replace('/');
    },
  });
  const reauthenticate = useMutation({
    mutationFn: signOut,
    onSuccess: () => router.replace('/auth?returnTo=%2Faccount-deletion'),
  });
  const current = deletion.data?.request;
  const requestError = request.error;
  const blocked = deletion.data && !deletion.data.eligible;

  return (
    <Screen>
      <PageHeader title={t('deletion.title')} subtitle={t('deletion.subtitle')} />
      {Platform.OS === 'web' && <Notice>{t('deletion.webResource')}</Notice>}
      <Card>
        <Section>{t('deletion.whatHappens')}</Section>
        <Label>{t('deletion.profileRemoved')}</Label>
        <Label>{t('deletion.sharedHistory')}</Label>
        <Label>{t('deletion.activeLoansBlock')}</Label>
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
            <Notice
              tone={
                current.status === 'FAILED'
                  ? 'danger'
                  : current.status === 'PENDING' || current.status === 'PROCESSING'
                    ? 'warning'
                    : undefined
              }
            >
              {t(`deletion.status.${current.status}`)}
            </Notice>
          )}
          {blocked && (
            <Notice tone="warning">
              {t('deletion.blocked', {
                loans: deletion.data.blocking_loan_count,
                repayments: deletion.data.blocking_repayment_count,
              })}
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
              label={t(current ? 'deletion.retry' : 'deletion.submit')}
              loading={request.isPending}
              disabled={Boolean(blocked)}
              onPress={() =>
                Alert.alert(t('deletion.title'), t('deletion.finalWarning'), [
                  { text: t('loan.cancel'), style: 'cancel' },
                  {
                    text: t('deletion.confirmDelete'),
                    style: 'destructive',
                    onPress: () => request.mutate(),
                  },
                ])
              }
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
