import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  acceptLoanInvite,
  declineLoanInvite,
  getLoanInvitePreview,
  type LoanInvitePreview,
} from '@/features/loans/api';
import { isInviteToken, makeIdempotencyKey } from '@/features/loans/invite';
import { formatMoneyMinor } from '@/lib/format';
import { useAuthStore } from '@/stores/auth-store';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [preview, setPreview] = useState<LoanInvitePreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!isInviteToken(token)) return;
    void getLoanInvitePreview(token)
      .then(setPreview)
      .catch(() => setPreviewFailed(true));
  }, [token]);

  const respond = async (decision: 'accept' | 'decline') => {
    if (!isInviteToken(token)) return Alert.alert(t('appName'), t('loan.invalidInvite'));
    if (!session)
      return router.push({ pathname: '/auth', params: { returnTo: `/invite/${token}` } });

    setAction(decision);
    try {
      const result =
        decision === 'accept'
          ? await acceptLoanInvite(token, makeIdempotencyKey())
          : await declineLoanInvite(token, makeIdempotencyKey());
      Alert.alert(
        t('appName'),
        result.status === 'ACTIVE' ? t('loan.inviteAccepted') : t('loan.inviteDeclined'),
        [{ text: t('loan.confirm'), onPress: () => router.replace('/') }],
      );
    } catch {
      Alert.alert(t('appName'), t('loan.somethingWentWrong'));
    } finally {
      setAction(null);
    }
  };

  if (!isInviteToken(token) || previewFailed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('loan.invalidInvite')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('appName')}</Text>
        <Text style={styles.title}>{t('loan.inviteTitle')}</Text>
        <Text style={styles.description}>{t('loan.inviteDescription')}</Text>
        <View style={styles.card}>
          {!preview ? (
            <ActivityIndicator color="#1D4ED8" />
          ) : (
            <>
              <Text style={styles.cardTitle}>
                {formatMoneyMinor(preview.principal_minor, preview.currency, i18n.language)}
              </Text>
              <Text style={styles.cardBody}>
                {t('loan.loanDate')}: {preview.loan_date}
                {'\n'}
                {t('loan.dueDate')}: {preview.due_date}
                {'\n'}
                {preview.target_role === 'LENDER' ? t('loan.lender') : t('loan.borrower')}
                {preview.purpose ? `\n${preview.purpose}` : ''}
              </Text>
            </>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('loan.acceptInvite')}
          disabled={action !== null || !preview}
          onPress={() => void respond('accept')}
          style={({ pressed }) => [
            styles.acceptButton,
            (pressed || action !== null) && styles.pressed,
          ]}
        >
          {action === 'accept' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptText}>{t('loan.acceptInvite')}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('loan.declineInvite')}
          disabled={action !== null || !preview}
          onPress={() => void respond('decline')}
          style={({ pressed }) => [
            styles.declineButton,
            (pressed || action !== null) && styles.pressed,
          ]}
        >
          {action === 'decline' ? (
            <ActivityIndicator color="#1D4ED8" />
          ) : (
            <Text style={styles.declineText}>{t('loan.declineInvite')}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  eyebrow: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  title: { color: '#101828', fontSize: 28, fontWeight: '700', lineHeight: 36 },
  description: { color: '#475467', fontSize: 16, lineHeight: 24, marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { color: '#101828', fontSize: 16, fontWeight: '700' },
  cardBody: { color: '#667085', fontSize: 14, lineHeight: 20 },
  acceptButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
  },
  acceptText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  declineButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  declineText: { color: '#1D4ED8', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
