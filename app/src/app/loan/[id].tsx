import { ActivityIndicator, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { accountKey } from '@/lib/account-boundary';
import { Alert } from '@/lib/alert';
import { shareInviteLink } from '@/lib/share-invite';
import {
  decideRepayment,
  getLoanRepayments,
  getLoanRoom,
  manageLoanInvite,
  type Repayment,
  type LoanRoom,
} from '@/features/loans/api';
import { useIdempotentCommand } from '@/hooks/use-idempotent-command';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate, formatMoneyMinor } from '@/lib/format';
import { loanEventLabel, loanStatusLabel } from '@/i18n/loan-labels';
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
  StatusBadge,
  usePalette,
} from '@/components/loan-ui';
type HistoryRow =
  | { kind: 'repayment'; value: Repayment }
  | { kind: 'event'; value: LoanRoom['timeline'][number] }
  | { kind: 'empty'; section: 'repayments' | 'timeline' };
export default function LoanRoomScreen() {
  const p = usePalette();
  const command = useIdempotentCommand();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const room = useQuery({
    queryKey: accountKey(session?.user.id, 'loan-room', id),
    queryFn: () => getLoanRoom(id),
    enabled: isHydrated && Boolean(session && id),
  });
  const repayments = useQuery({
    queryKey: accountKey(session?.user.id, 'loan-repayments', id),
    queryFn: () => getLoanRepayments(id),
    enabled: isHydrated && Boolean(session && id),
  });
  const decision = useMutation({
    mutationFn: ({
      repaymentId,
      action,
    }: {
      repaymentId: string;
      action: 'confirm' | 'dispute' | 'cancel';
    }) =>
      command.run(`${action}_repayment`, { repaymentId }, (key) =>
        decideRepayment(repaymentId, action, key),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountKey(session?.user.id, 'loan-room', id),
      });
      void queryClient.invalidateQueries({
        queryKey: accountKey(session?.user.id, 'loan-repayments', id),
      });
      void queryClient.invalidateQueries({ queryKey: accountKey(session?.user.id, 'loans') });
    },
    onError: () => Alert.alert(t('appName'), t('loan.somethingWentWrong')),
  });
  const invite = useMutation({
    mutationFn: async (action: 'rotate' | 'revoke') => {
      const result = await command.run('manage_loan_invite', { loanId: id, action }, (key) =>
        manageLoanInvite(id, action, key),
      );
      let shareFailed = false;
      if (result.invite_token) {
        try {
          await shareInviteLink(
            Linking.createURL(`/invite/${result.invite_token}`),
            t('loan.shareInvite'),
            t('loan.inviteShareInstructions'),
          );
        } catch {
          shareFailed = true;
        }
      }
      command.clearCompleted();
      return { ...result, shareFailed };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: accountKey(session?.user.id, 'loan-room', id),
      });
      if (result.action === 'revoke') Alert.alert(t('appName'), t('loan.inviteRevoked'));
      else if (!result.invite_token) Alert.alert(t('appName'), t('loan.invalidInvite'));
      else if (result.shareFailed) Alert.alert(t('appName'), t('loan.inviteShareFailed'));
      else Alert.alert(t('loan.inviteReplaced'), t('loan.inviteReplacedHelp'));
    },
    onError: () => Alert.alert(t('appName'), t('loan.somethingWentWrong')),
  });
  if (!isHydrated)
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  if (!session) return <Redirect href="/auth" />;
  if (room.isLoading)
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  if (!room.data)
    return (
      <Screen>
        <PageHeader title={t('loan.loanRoom')} />
        <Notice tone="danger">{t('loan.somethingWentWrong')}</Notice>
        <Button
          kind="secondary"
          label={t('settings.tryAgain')}
          onPress={() => void room.refetch()}
        />
      </Screen>
    );
  const loan = room.data;
  const paid = Math.max(0, loan.principal_minor - loan.balance_minor);
  const progress =
    loan.principal_minor > 0
      ? Math.max(0, Math.min(100, Math.round((paid / loan.principal_minor) * 100)))
      : 0;
  const sections: { title: string; data: HistoryRow[] }[] = [
    {
      title: t('loan.repayments'),
      data: repayments.data?.length
        ? repayments.data.map((value) => ({ kind: 'repayment', value }))
        : [{ kind: 'empty', section: 'repayments' }],
    },
    {
      title: t('loan.timeline'),
      data: loan.timeline.length
        ? loan.timeline.map((value) => ({ kind: 'event', value }))
        : [{ kind: 'empty', section: 'timeline' }],
    },
  ];
  const renderRow = (item: HistoryRow) => {
    if (item.kind === 'empty')
      return (
        <Card>
          {item.section === 'repayments' && repayments.isLoading ? (
            <ActivityIndicator color={p.primary} />
          ) : item.section === 'repayments' && repayments.isError ? (
            <>
              <Label muted>{t('loan.somethingWentWrong')}</Label>
              <Button
                kind="secondary"
                label={t('settings.tryAgain')}
                onPress={() => void repayments.refetch()}
              />
            </>
          ) : (
            <Label muted>
              {t(item.section === 'repayments' ? 'ui.noRepayments' : 'ui.noActivity')}
            </Label>
          )}
        </Card>
      );
    if (item.kind === 'event') {
      const event = item.value;
      return (
        <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 16, paddingHorizontal: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: p.soft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={event.event_type.includes('CONFIRMED') ? 'check' : 'clock'}
              color={p.primary}
              size={16}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[base.fieldLabel, { color: p.text }]}>
              {loanEventLabel(event.event_type, t)}
            </Text>
            {event.event_type === 'REPAYMENT_CANCELLED' &&
              event.metadata.reason === 'LOAN_REPAID' && (
                <Label muted>{t('loan.autoCancelledRepaid')}</Label>
              )}
            <Text style={[base.caption, { color: p.muted }]}>
              {new Date(event.created_at).toLocaleString(i18n.language)}
            </Text>
          </View>
        </View>
      );
    }
    const repayment = item.value;
    const own = repayment.created_by === session.user.id;
    return (
      <Card style={{ marginBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Text style={[base.section, { color: p.text, fontVariant: ['tabular-nums'] }]}>
            {formatMoneyMinor(repayment.amount_minor, loan.currency, i18n.language)}
          </Text>
          <StatusBadge status={repayment.status} />
        </View>
        <Text style={[base.body, { color: p.muted }]}>
          {formatDate(repayment.payment_date, i18n.language)}
          {repayment.note ? ` · ${repayment.note}` : ''}
        </Text>
        {repayment.status === 'PENDING' && (
          <View style={{ gap: 8 }}>
            {own ? (
              <Button
                kind="secondary"
                disabled={decision.isPending}
                label={t('loan.cancel')}
                onPress={() => decision.mutate({ repaymentId: repayment.id, action: 'cancel' })}
              />
            ) : (
              <>
                <Button
                  icon="check"
                  disabled={decision.isPending}
                  label={t('loan.confirmRepayment')}
                  onPress={() =>
                    Alert.alert(
                      t('loan.confirmRepayment'),
                      t('loan.confirmReceived', {
                        amount: formatMoneyMinor(
                          repayment.amount_minor,
                          loan.currency,
                          i18n.language,
                        ),
                      }),
                      [
                        { text: t('loan.cancel'), style: 'cancel' },
                        {
                          text: t('loan.confirm'),
                          onPress: () =>
                            decision.mutate({ repaymentId: repayment.id, action: 'confirm' }),
                        },
                      ],
                    )
                  }
                />
                <Button
                  kind="quiet"
                  disabled={decision.isPending}
                  label={t('loan.dispute')}
                  onPress={() => decision.mutate({ repaymentId: repayment.id, action: 'dispute' })}
                />
              </>
            )}
          </View>
        )}
      </Card>
    );
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: p.background }}
    >
      <SectionList
        sections={sections}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[base.page, { gap: 0 }]}
        keyExtractor={(item) =>
          item.kind === 'empty' ? item.section : `${item.kind}:${item.value.id}`
        }
        renderItem={({ item }) => renderRow(item)}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: 24, paddingBottom: 16 }}>
            <Section>{section.title}</Section>
          </View>
        )}
        ListHeaderComponent={
          <View style={{ gap: 24 }}>
            <PageHeader title={t('loan.loanRoom')} />
            <View style={{ backgroundColor: p.hero, borderRadius: 24, padding: 24, gap: 16 }}>
              <Text style={[base.caption, { color: p.heroMuted }]}>
                {t('loan.remaining')} · {loanStatusLabel(loan.status, t)}
              </Text>
              <Text style={[base.amount, { color: p.heroText }]}>
                {formatMoneyMinor(loan.balance_minor, loan.currency, i18n.language)}
              </Text>
              <View
                accessibilityRole="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                accessibilityLabel={t('ui.progress')}
                accessibilityValue={{ min: 0, max: 100, now: progress }}
                style={{
                  height: 8,
                  backgroundColor: '#426454',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${progress}%`,
                    height: 8,
                    backgroundColor: p.accent,
                    borderRadius: 4,
                  }}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={[base.caption, { color: p.heroMuted }]}>
                  {t('ui.paidSoFar')}: {formatMoneyMinor(paid, loan.currency, i18n.language)}
                </Text>
                <Text style={[base.caption, { color: p.heroMuted }]}>
                  {t('ui.originalAmount')}:{' '}
                  {formatMoneyMinor(loan.principal_minor, loan.currency, i18n.language)}
                </Text>
              </View>
            </View>
            {loan.status === 'REPAID' && (
              <Notice>
                {t('ui.settledTitle')} {t('ui.settledBody')}
              </Notice>
            )}
            {loan.status === 'PENDING' && (
              <Card>
                <Notice tone="warning">{t('loan.bearerInviteWarning')}</Notice>
                <Button
                  kind="secondary"
                  icon="plus"
                  disabled={invite.isPending}
                  label={t('loan.replaceInvite')}
                  onPress={() =>
                    Alert.alert(t('loan.replaceInvite'), t('loan.replaceInviteWarning'), [
                      { text: t('loan.cancel'), style: 'cancel' },
                      { text: t('loan.confirm'), onPress: () => invite.mutate('rotate') },
                    ])
                  }
                />
                <Button
                  kind="quiet"
                  disabled={invite.isPending}
                  label={t('loan.revokeInvite')}
                  onPress={() =>
                    Alert.alert(t('loan.revokeInvite'), t('loan.revokeInviteWarning'), [
                      { text: t('loan.cancel'), style: 'cancel' },
                      { text: t('loan.confirm'), onPress: () => invite.mutate('revoke') },
                    ])
                  }
                />
              </Card>
            )}
            <Card>
              <Section>{t('ui.loanDetails')}</Section>
              <Label>{loan.purpose || t('loan.sharedLoan')}</Label>
              <View style={{ borderTopWidth: 1, borderColor: p.border, paddingTop: 16, gap: 12 }}>
                <Detail
                  label={t('loan.loanDate')}
                  value={formatDate(loan.loan_date, i18n.language)}
                />
                <Detail
                  label={t('loan.dueDate')}
                  value={formatDate(loan.due_date, i18n.language)}
                />
              </View>
            </Card>
            <Card>
              <Section>{t('loan.members')}</Section>
              {loan.members.map((member) => (
                <View key={member.role} style={base.row}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 16,
                      backgroundColor: p.soft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={member.role === 'LENDER' ? 'arrow-up' : 'arrow-down'}
                      color={p.primary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Label>{member.display_name || t('ui.member')}</Label>
                    <Text style={[base.caption, { color: p.muted }]}>
                      {t(member.role === 'LENDER' ? 'ui.lenderRole' : 'ui.borrowerRole')}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        }
      />
      {loan.status === 'ACTIVE' && (
        <View style={[base.footer, { backgroundColor: p.background, borderColor: p.border }]}>
          <View style={base.footerContent}>
            <Button
              icon="plus"
              label={t('loan.recordRepayment')}
              onPress={() => router.push(`/loan/${id}/repayment`)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
    >
      <Text style={[base.caption, { color: p.muted }]}>{label}</Text>
      <Text style={[base.fieldLabel, { color: p.text }]}>{value}</Text>
    </View>
  );
}
