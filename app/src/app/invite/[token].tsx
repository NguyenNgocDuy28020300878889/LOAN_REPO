import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  acceptLoanInvite,
  declineLoanInvite,
  getLoanInvitePreview,
  type LoanInvitePreview,
} from '@/features/loans/api';
import {
  getInviteUnavailableReason,
  isInviteToken,
  type InviteUnavailableReason,
} from '@/features/loans/invite';
import { useIdempotentCommand } from '@/hooks/use-idempotent-command';
import { formatMoneyMinor } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';
import { Alert } from '@/lib/alert';
import {
  base,
  Brand,
  Button,
  Card,
  Icon,
  Label,
  Notice,
  Screen,
  Section,
  usePalette,
} from '@/components/loan-ui';
export default function InviteScreen() {
  const p = usePalette();
  const command = useIdempotentCommand();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id;
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [preview, setPreview] = useState<LoanInvitePreview | null>(null);
  const [previewFailure, setPreviewFailure] = useState<InviteUnavailableReason | null>(null);

  useEffect(() => {
    setPreview(null);
    setPreviewFailure(null);
    if (!isHydrated || !userId || !isInviteToken(token)) return;
    let active = true;
    void getLoanInvitePreview(token)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((error) => {
        if (active) setPreviewFailure(getInviteUnavailableReason(error));
      });
    return () => {
      active = false;
    };
  }, [token, userId, isHydrated]);

  const respond = async (decision: 'accept' | 'decline') => {
    if (!isInviteToken(token)) return Alert.alert(t('appName'), t('loan.invalidInvite'));
    if (!session)
      return router.push({ pathname: '/auth', params: { returnTo: `/invite/${token}` } });

    setAction(decision);
    try {
      const result = await command.run<{ loan_id: string; status: 'ACTIVE' | 'DECLINED' }>(
        `${decision}_loan_invite`,
        { token },
        (key) =>
          decision === 'accept' ? acceptLoanInvite(token, key) : declineLoanInvite(token, key),
      );
      Alert.alert(
        result.status === 'ACTIVE' ? t('loan.inviteAccepted') : t('loan.inviteDeclined'),
        result.status === 'ACTIVE' ? t('loan.inviteAcceptedHelp') : t('loan.inviteDeclinedHelp'),
        [
          {
            text: t('loan.confirm'),
            onPress: () =>
              result.status === 'ACTIVE'
                ? router.replace(`/loan/${result.loan_id}`)
                : router.replace('/'),
          },
        ],
      );
    } catch (error) {
      const reason = getInviteUnavailableReason(error);
      Alert.alert(
        t('appName'),
        t(
          reason === 'expired'
            ? 'loan.inviteExpired'
            : reason === 'revoked'
              ? 'loan.inviteRevokedLink'
              : reason === 'used'
                ? 'loan.inviteUnavailable'
                : 'loan.somethingWentWrong',
        ),
      );
    } finally {
      setAction(null);
    }
  };

  if (!isHydrated)
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  if (!session && isInviteToken(token))
    return (
      <Screen
        footer={
          <Button
            label={t('auth.signIn')}
            icon="forward"
            onPress={() =>
              router.push({ pathname: '/auth', params: { returnTo: `/invite/${token}` } })
            }
          />
        }
      >
        <Brand />
        <View style={{ paddingVertical: 24, gap: 24 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: p.soft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="lock" size={40} color={p.primary} />
          </View>
          <Text style={[base.fieldLabel, { color: p.primary }]}>{t('ui.inviteEyebrow')}</Text>
          <Text accessibilityRole="header" style={[base.amount, { color: p.text }]}>
            {t('loan.inviteTitle')}
          </Text>
          <Label muted>{t('loan.inviteSignIn')}</Label>
        </View>
        <Notice>{t('ui.invitePrivate')}</Notice>
      </Screen>
    );
  if (!isInviteToken(token) || previewFailure)
    return (
      <Screen>
        <Brand />
        <Card>
          <Section>
            {t(
              previewFailure === 'expired'
                ? 'loan.inviteExpired'
                : previewFailure === 'revoked'
                  ? 'loan.inviteRevokedLink'
                  : previewFailure === 'used'
                    ? 'loan.inviteUnavailable'
                    : 'loan.invalidInvite',
            )}
          </Section>
          <Button kind="secondary" label={t('ui.loansTab')} onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label={t('loan.acceptInvite')}
            icon="check"
            loading={action === 'accept'}
            disabled={action !== null || !preview}
            onPress={() => void respond('accept')}
          />
          <Button
            kind="quiet"
            label={t('loan.declineInvite')}
            loading={action === 'decline'}
            disabled={action !== null || !preview}
            onPress={() => void respond('decline')}
          />
        </View>
      }
    >
      <Brand />
      <View style={{ gap: 12 }}>
        <Text style={[base.fieldLabel, { color: p.primary }]}>{t('ui.inviteEyebrow')}</Text>
        <Text accessibilityRole="header" style={[base.title, { color: p.text }]}>
          {t('loan.inviteTitle')}
        </Text>
        <Label muted>{t('loan.inviteDescription')}</Label>
      </View>
      {!preview ? (
        <ActivityIndicator color={p.primary} />
      ) : (
        <>
          <View style={{ backgroundColor: p.hero, borderRadius: 24, padding: 24, gap: 12 }}>
            <Text style={[base.caption, { color: p.heroMuted }]}>{t('loan.amount')}</Text>
            <Text style={[base.amount, { color: p.heroText }]}>
              {formatMoneyMinor(preview.principal_minor, preview.currency, i18n.language)}
            </Text>
            <Text style={[base.body, { color: p.heroMuted }]}>
              {t(preview.target_role === 'LENDER' ? 'loan.lender' : 'loan.borrower')}
            </Text>
          </View>
          <Card>
            <Section>{t('ui.invitationSummary')}</Section>
            {preview.purpose && <Label>{preview.purpose}</Label>}
            <Label muted>
              {t('loan.loanDate')}: {preview.loan_date}
            </Label>
            <Label muted>
              {t('loan.dueDate')}: {preview.due_date}
            </Label>
          </Card>
          <Notice tone="warning">{t('loan.bearerInviteWarning')}</Notice>
        </>
      )}
    </Screen>
  );
}
