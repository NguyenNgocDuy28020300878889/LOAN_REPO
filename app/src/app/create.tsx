import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createLoan } from '@/features/loans/api';
import { useIdempotentCommand } from '@/hooks/use-idempotent-command';
import { formatDate, formatMoneyMinor, localDateOnly } from '@/lib/format';
import { parseAmountInput, parseDateInput, isoToDateInput } from '@/lib/form-input';
import { AmountField } from '@/components/amount-field';
import { DateField } from '@/components/date-field';
import { useAuthStore } from '@/stores/auth-store';
import { shareInviteLink } from '@/lib/share-invite';
import { createInviteLink } from '@/features/loans/invite-link';
import { Alert } from '@/lib/alert';
import {
  base,
  Button,
  Card,
  Field,
  Icon,
  Notice,
  PageHeader,
  Screen,
  Section,
  usePalette,
  selectionKeyProps,
} from '@/components/loan-ui';

export default function CreateScreen() {
  const p = usePalette();
  const command = useIdempotentCommand();
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [role, setRole] = useState<'LENDER' | 'BORROWER'>('LENDER');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [loanDate, setLoanDate] = useState(() => isoToDateInput(localDateOnly()));
  const [dueDate, setDueDate] = useState(() => isoToDateInput(localDateOnly()));
  const [purpose, setPurpose] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!session) return router.push('/auth');
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      Alert.alert(t('appName'), t('loan.invalidCurrency'));
      return;
    }
    const trimmedEmail = recipientEmail.trim().toLowerCase();
    if (trimmedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        Alert.alert(t('appName'), t('loan.invalidRecipientEmail'));
        return;
      }
      if (session?.user?.email && trimmedEmail === session.user.email.toLowerCase()) {
        Alert.alert(t('appName'), t('loan.cannotInviteSelf'));
        return;
      }
    }
    let loanDateIso: string;
    let dueDateIso: string;
    try {
      loanDateIso = parseDateInput(loanDate);
      dueDateIso = parseDateInput(dueDate);
      if (dueDateIso < loanDateIso) throw new Error('INVALID_DATE_ORDER');
    } catch {
      Alert.alert(t('appName'), t('loan.invalidDueDate'));
      return;
    }
    let principalMinor: number;
    try {
      principalMinor = parseAmountInput(amount, normalizedCurrency);
    } catch {
      Alert.alert(t('appName'), t('loan.invalidAmount'));
      return;
    }
    const createAndShare = async () => {
      setLoading(true);
      try {
        const payload = {
          creatorRole: role,
          principalMinor,
          currency: normalizedCurrency,
          loanDate: loanDateIso,
          dueDate: dueDateIso,
          purpose: purpose || undefined,
          recipientEmail: trimmedEmail || undefined,
        };
        const result = await command.run('create_loan', payload, (key) =>
          createLoan({ ...payload, idempotencyKey: key }),
        );
        let shareFailed = false;
        if (result.invite_token) {
          try {
            await shareInviteLink(
              createInviteLink(result.invite_token),
              t('loan.shareInvite'),
              t('loan.inviteShareInstructions'),
            );
          } catch {
            shareFailed = true;
          }
        }
        const successMessage = trimmedEmail
          ? `${t('loan.createdHelp')}\n\n${t('loan.inAppInviteNotice')}`
          : t('loan.createdHelp');
        Alert.alert(
          t('loan.created'),
          shareFailed ? `${successMessage}\n\n${t('loan.inviteShareFailed')}` : successMessage,
          [
            {
              text: t('loan.confirm'),
              onPress: () => {
                command.clearCompleted();
                setAmount('');
                setPurpose('');
                setRecipientEmail('');
                router.replace(`/loan/${result.loan_id}`);
              },
            },
          ],
        );
      } catch {
        Alert.alert(t('appName'), t('loan.somethingWentWrong'));
      } finally {
        setLoading(false);
      }
    };

    const confirmDetails = [
      `${t('loan.role')}: ${role === 'LENDER' ? t('loan.lender') : t('loan.borrower')}`,
      `${t('loan.amount')}: ${formatMoneyMinor(principalMinor, normalizedCurrency, i18n.language)}`,
      `${t('loan.loanDate')}: ${formatDate(loanDateIso, i18n.language)}`,
      `${t('loan.dueDate')}: ${formatDate(dueDateIso, i18n.language)}`,
    ];
    if (trimmedEmail) {
      confirmDetails.push(`${t('loan.recipientEmail')}: ${trimmedEmail}`);
    }

    Alert.alert(t('loan.confirmLoan'), confirmDetails.join('\n'), [
      { text: t('loan.cancel'), style: 'cancel' },
      { text: t('loan.shareInvite'), onPress: () => void createAndShare() },
    ]);
  };

  return (
    <Screen
      footer={<Button label={t('loan.create')} icon="forward" loading={loading} onPress={submit} />}
    >
      <PageHeader title={t('loan.create')} subtitle={t('ui.createSubtitle')} />
      <Card>
        <Section>{t('loan.role')}</Section>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('loan.role')}
          style={{ gap: 12 }}
        >
          {(['LENDER', 'BORROWER'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              {...selectionKeyProps(() => setRole(value))}
              aria-checked={role === value}
              accessibilityState={{ selected: role === value, checked: role === value }}
              onPress={() => setRole(value)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  minHeight: 64,
                  borderWidth: 2,
                  borderRadius: 16,
                  borderColor: role === value ? p.primary : p.border,
                  backgroundColor: role === value ? p.soft : p.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Icon name={value === 'LENDER' ? 'arrow-up' : 'arrow-down'} color={p.primary} />
              <Text style={[base.section, { color: p.text, flex: 1 }]}>
                {t(value === 'LENDER' ? 'loan.lender' : 'loan.borrower')}
              </Text>
              {role === value && <Icon name="check" color={p.primary} size={20} />}
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <Section>{t('ui.agreementDetails')}</Section>
        <AmountField
          label={t('loan.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          hint={t('loan.amountHint')}
          style={{ fontSize: 32, lineHeight: 44, fontWeight: '700', fontVariant: ['tabular-nums'] }}
        />
        <Field
          label={t('loan.currency')}
          value={currency}
          onChangeText={setCurrency}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={3}
        />
        <Field
          label={t('loan.purpose')}
          value={purpose}
          onChangeText={setPurpose}
          maxLength={280}
        />
        <Field
          label={t('loan.recipientEmail')}
          value={recipientEmail}
          onChangeText={setRecipientEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={255}
          hint={t('loan.recipientEmailHelp')}
        />
      </Card>
      <Card>
        <Section>{t('ui.dates')}</Section>
        <DateField
          label={`${t('loan.loanDate')} (DD/MM/YYYY)`}
          value={loanDate}
          onChangeText={setLoanDate}
          placeholder="DD/MM/YYYY"
          keyboardType="number-pad"
          autoCorrect={false}
          maxLength={10}
          hint={t('ui.dateHint')}
        />
        <DateField
          label={`${t('loan.dueDate')} (DD/MM/YYYY)`}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="DD/MM/YYYY"
          keyboardType="number-pad"
          autoCorrect={false}
          maxLength={10}
        />
      </Card>
      <Notice>{t('loan.review')}</Notice>
    </Screen>
  );
}
