import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getLoanRoom, submitRepayment } from '@/features/loans/api';
import { makeIdempotencyKey } from '@/features/loans/invite';
import { parseMoneyToMinor } from '@/lib/format';

export default function RepaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const loan = useQuery({
    queryKey: ['loan-room', id],
    queryFn: () => getLoanRoom(id),
    enabled: Boolean(id),
  });
  const submit = async () => {
    let amountMinor: number;
    try {
      amountMinor = parseMoneyToMinor(amount, loan.data?.currency ?? 'USD');
    } catch {
      Alert.alert(t('appName'), t('loan.invalidAmount'));
      return;
    }
    setLoading(true);
    try {
      await submitRepayment({
        loanId: id,
        amountMinor,
        paymentDate: new Date().toISOString().slice(0, 10),
        note: note || undefined,
        idempotencyKey: makeIdempotencyKey(),
      });
      Alert.alert(t('appName'), t('loan.repaymentSubmitted'), [
        { text: t('loan.confirm'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('appName'), t('loan.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };
  if (loan.isLoading || !loan.data)
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#1D4ED8" style={styles.loader} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('loan.loanRoom')}</Text>
        <Text style={styles.title}>{t('loan.recordRepayment')}</Text>
        <Text style={styles.help}>{t('loan.repaymentReview')}</Text>
        <TextInput
          accessibilityLabel={`${t('loan.amount')} (${loan.data.currency})`}
          keyboardType="numeric"
          onChangeText={setAmount}
          placeholder={`${t('loan.amount')} (${loan.data.currency})`}
          placeholderTextColor="#667085"
          style={styles.input}
          value={amount}
        />
        <Text style={styles.help}>{t('loan.amountHint')}</Text>
        <TextInput
          accessibilityLabel={t('loan.note')}
          onChangeText={setNote}
          placeholder={t('loan.note')}
          placeholderTextColor="#667085"
          style={styles.input}
          value={note}
        />
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void submit()}
          style={({ pressed }) => [styles.primary, (pressed || loading) && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{t('loan.recordRepayment')}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  eyebrow: { color: '#1D4ED8', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#101828' },
  help: { color: '#667085', lineHeight: 21 },
  input: {
    minHeight: 52,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#101828',
  },
  primary: {
    minHeight: 52,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  loader: { marginTop: 48 },
});
