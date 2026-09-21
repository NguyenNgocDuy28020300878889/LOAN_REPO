import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getPendingInviteDetail,
  respondToInvite,
  type PendingInviteSummary,
} from '@/features/loans/api';
import { useIdempotentCommand } from '@/hooks/use-idempotent-command';
import { formatDate, formatMoneyMinor } from '@/lib/format';
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

export default function PendingInviteScreen() {
  const p = usePalette();
  const command = useIdempotentCommand();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const userId = session?.user.id;
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [invite, setInvite] = useState<PendingInviteSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setInvite(null);
    setFailed(false);
    if (!isHydrated || !userId || !id) return;
    let active = true;
    void getPendingInviteDetail(id)
      .then((value) => {
        if (active) setInvite(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id, userId, isHydrated]);

  const respond = async (decision: 'accept' | 'decline') => {
    if (!id) return;
    if (!session) {
      return router.push({ pathname: '/auth', params: { returnTo: `/pending-invite/${id}` } });
    }

    setAction(decision);
    try {
      const result = await command.run<{ loan_id: string; status: 'ACTIVE' | 'DECLINED' }>(
        `respond_to_invite_${decision}`,
        { loan_id: id, decision },
        (key) => respondToInvite(id, decision, key),
      );
      Alert.alert(
        result.status === 'ACTIVE' ? t('loan.inviteAccepted') : t('loan.inviteDeclined'),
        result.status === 'ACTIVE' ? t('loan.inviteAcceptedHelp') : t('loan.inviteDeclinedHelp'),
        [
          {
            text: t('loan.confirm'),
            onPress: () => {
              if (result.status === 'ACTIVE') {
                router.replace(`/loan/${id}`);
              } else {
                router.replace('/');
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert(t('appName'), t('loan.somethingWentWrong'));
    } finally {
      setAction(null);
    }
  };

  if (!isHydrated) {
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen
        footer={
          <Button
            label={t('auth.signIn')}
            icon="forward"
            onPress={() =>
              router.push({ pathname: '/auth', params: { returnTo: `/pending-invite/${id}` } })
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
  }

  if (failed) {
    return (
      <Screen>
        <Brand />
        <Card>
          <Section>{t('loan.invalidInvite')}</Section>
          <Button kind="secondary" label={t('ui.loansTab')} onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label={t('loan.acceptInvite')}
            icon="check"
            loading={action === 'accept'}
            disabled={action !== null || !invite}
            onPress={() => void respond('accept')}
          />
          <Button
            kind="quiet"
            label={t('loan.declineInvite')}
            loading={action === 'decline'}
            disabled={action !== null || !invite}
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
      {!invite ? (
        <ActivityIndicator color={p.primary} />
      ) : (
        <>
          <View style={{ backgroundColor: p.hero, borderRadius: 24, padding: 24, gap: 12 }}>
            <Text style={[base.caption, { color: p.heroMuted }]}>{t('loan.amount')}</Text>
            <Text style={[base.amount, { color: p.heroText }]}>
              {formatMoneyMinor(invite.principal_minor, invite.currency, i18n.language)}
            </Text>
            <Text style={[base.body, { color: p.heroMuted }]}>
              {t(invite.my_role === 'LENDER' ? 'loan.lender' : 'loan.borrower')}
            </Text>
          </View>
          <Card>
            <Section>{t('ui.invitationSummary')}</Section>
            <Label>{t('loan.invitedBy', { name: invite.creator_name })}</Label>
            {invite.purpose ? <Label>{invite.purpose}</Label> : null}
            {invite.note ? <Label muted>{invite.note}</Label> : null}
            <Label muted>
              {t('loan.loanDate')}: {formatDate(invite.loan_date, i18n.language)}
            </Label>
            <Label muted>
              {t('loan.dueDate')}: {formatDate(invite.due_date, i18n.language)}
            </Label>
          </Card>
        </>
      )}
    </Screen>
  );
}
