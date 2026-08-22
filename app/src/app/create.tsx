import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { createLoan } from '@/features/loans/api';
import { makeIdempotencyKey } from '@/features/loans/invite';
import { formatDate, formatMoneyMinor, parseMoneyToMinor } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

const today = new Date().toISOString().slice(0, 10);

export default function CreateScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [role, setRole] = useState<'LENDER' | 'BORROWER'>('LENDER');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [dueDate, setDueDate] = useState(today);
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!session) return router.push('/auth');
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      Alert.alert(t('appName'), t('loan.invalidCurrency'));
      return;
    }
    if (!isValidIsoDate(dueDate) || dueDate < today) {
      Alert.alert(t('appName'), t('loan.invalidDueDate'));
      return;
    }
    let principalMinor: number;
    try {
      principalMinor = parseMoneyToMinor(amount, normalizedCurrency);
    } catch {
      Alert.alert(t('appName'), t('loan.invalidAmount'));
      return;
    }
    const createAndShare = async () => {
      setLoading(true);
      try {
        const result = await createLoan({
          creatorRole: role,
          principalMinor,
          currency: normalizedCurrency,
          loanDate: today,
          dueDate,
          purpose: purpose || undefined,
          idempotencyKey: makeIdempotencyKey(),
        });
        await Share.share({
          message: Linking.createURL(`/invite/${result.invite_token}`),
          title: t('loan.shareInvite'),
        });
        Alert.alert(t('loan.created'), t('loan.inviteShared'), [
          { text: t('loan.confirm'), onPress: () => router.replace('/') },
        ]);
      } catch {
        Alert.alert(t('appName'), t('loan.somethingWentWrong'));
      } finally {
        setLoading(false);
      }
    };

    Alert.alert(
      t('loan.confirmLoan'),
      [
        `${t('loan.role')}: ${role === 'LENDER' ? t('loan.lender') : t('loan.borrower')}`,
        `${t('loan.amount')}: ${formatMoneyMinor(principalMinor, normalizedCurrency, i18n.language)}`,
        `${t('loan.loanDate')}: ${formatDate(today, i18n.language)}`,
        `${t('loan.dueDate')}: ${formatDate(dueDate, i18n.language)}`,
      ].join('\n'),
      [
        { text: t('loan.cancel'), style: 'cancel' },
        { text: t('loan.shareInvite'), onPress: () => void createAndShare() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{t('appName')}</Text>
        <Text style={styles.title}>{t('loan.create')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('loan.role')}</Text>
          <View style={styles.row}>
            {(['LENDER', 'BORROWER'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === value }}
                onPress={() => setRole(value)}
                style={[styles.role, role === value && styles.roleSelected]}
              >
                <Text style={role === value ? styles.roleTextSelected : styles.roleText}>
                  {value === 'LENDER' ? t('loan.lender') : t('loan.borrower')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label={t('loan.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          <Text style={styles.help}>{t('loan.amountHint')}</Text>
          <Field
            label={t('loan.currency')}
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
            maxLength={3}
          />
          <Field
            label={`${t('loan.dueDate')} (YYYY-MM-DD)`}
            value={dueDate}
            onChangeText={setDueDate}
          />
          <Field
            label={t('loan.purpose')}
            value={purpose}
            onChangeText={setPurpose}
            maxLength={280}
          />
        </View>
        <Text style={styles.help}>{t('loan.review')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={submit}
          style={({ pressed }) => [styles.primary, (pressed || loading) && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{t('loan.create')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#667085"
        style={styles.input}
        {...props}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { padding: 24, gap: 16 },
  eyebrow: { color: '#1D4ED8', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#101828' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 16 },
  row: { flexDirection: 'row', gap: 8 },
  role: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
  },
  roleSelected: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  roleText: { color: '#344054', fontWeight: '600' },
  roleTextSelected: { color: '#1D4ED8', fontWeight: '700' },
  field: { gap: 6 },
  label: { color: '#344054', fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#101828',
  },
  help: { color: '#667085', lineHeight: 20 },
  primary: {
    minHeight: 52,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.7 },
});
