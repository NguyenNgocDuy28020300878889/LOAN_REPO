import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { accountKey } from '@/lib/account-boundary';
import { Alert } from '@/lib/alert';
import { getLoanRoom, submitRepayment } from '@/features/loans/api';
import { useIdempotentCommand } from '@/hooks/use-idempotent-command';
import { localDateOnly, formatMoneyMinor } from '@/lib/format';
import { parseAmountInput } from '@/lib/form-input';
import { AmountField } from '@/components/amount-field';
import {
  base,
  Button,
  Card,
  Field,
  Label,
  Notice,
  PageHeader,
  Screen,
  usePalette,
} from '@/components/loan-ui';

export default function RepaymentScreen() {
  const p = usePalette();
  const { i18n } = useTranslation();
  const command = useIdempotentCommand();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const loan = useQuery({
    queryKey: accountKey(session?.user.id, 'loan-room', id),
    queryFn: () => getLoanRoom(id),
    enabled: isHydrated && Boolean(session && id),
  });
  const submit = async () => {
    let amountMinor: number;
    try {
      amountMinor = parseAmountInput(amount, loan.data?.currency ?? 'USD');
    } catch {
      Alert.alert(t('appName'), t('loan.invalidAmount'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        loanId: id,
        amountMinor,
        paymentDate: localDateOnly(),
        note: note || undefined,
      };
      await command.run('submit_repayment', payload, (key) =>
        submitRepayment({ ...payload, idempotencyKey: key }),
      );
      void queryClient.invalidateQueries({ queryKey: accountKey(session?.user.id) });
      Alert.alert(t('appName'), t('loan.repaymentSubmitted'), [
        {
          text: t('loan.confirm'),
          onPress: () => {
            command.clearCompleted();
            setAmount('');
            setNote('');
            router.replace(`/loan/${id}`);
          },
        },
      ]);
    } catch {
      Alert.alert(t('appName'), t('loan.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };
  if (!isHydrated)
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  if (!session) return <Redirect href="/auth" />;
  if (loan.isLoading)
    return (
      <Screen>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  if (!loan.data)
    return (
      <Screen>
        <PageHeader title={t('loan.recordRepayment')} />
        <Notice tone="danger">{t('loan.somethingWentWrong')}</Notice>
        <Button
          kind="secondary"
          label={t('settings.tryAgain')}
          onPress={() => void loan.refetch()}
        />
      </Screen>
    );
  return (
    <Screen
      footer={
        <Button
          label={t('loan.recordRepayment')}
          icon="check"
          loading={loading}
          disabled={loan.data.status !== 'ACTIVE'}
          onPress={() => void submit()}
        />
      }
    >
      <PageHeader title={t('loan.recordRepayment')} subtitle={t('ui.repaymentSubtitle')} />
      <View style={{ borderRadius: 24, padding: 24, gap: 8, backgroundColor: p.hero }}>
        <Text style={[base.caption, { color: p.heroMuted }]}>{t('loan.remaining')}</Text>
        <Text style={[base.amount, { color: p.heroText }]}>
          {formatMoneyMinor(loan.data.balance_minor, loan.data.currency, i18n.language)}
        </Text>
        <Text style={[base.body, { color: p.heroMuted }]}>
          {loan.data.purpose || t('loan.sharedLoan')}
        </Text>
      </View>
      <Card>
        <AmountField
          label={`${t('loan.amount')} (${loan.data.currency})`}
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          hint={t('loan.amountHint')}
          style={{ fontSize: 32, lineHeight: 44, fontWeight: '700', fontVariant: ['tabular-nums'] }}
        />
        <Field
          label={t('loan.note')}
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          style={{ minHeight: 104, textAlignVertical: 'top' }}
        />
      </Card>
      <Notice>{t('loan.repaymentReview')}</Notice>
      {loan.data.status !== 'ACTIVE' && <Label muted>{t('ui.loanNotActive')}</Label>}
    </Screen>
  );
}
