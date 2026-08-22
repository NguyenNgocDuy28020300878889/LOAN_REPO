import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { decideRepayment, getLoanRepayments, getLoanRoom } from '@/features/loans/api';
import { makeIdempotencyKey } from '@/features/loans/invite';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate, formatMoneyMinor } from '@/lib/format';
import { loanEventLabel, loanStatusLabel } from '@/i18n/loan-labels';

export default function LoanRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const room = useQuery({
    queryKey: ['loan-room', id],
    queryFn: () => getLoanRoom(id),
    enabled: Boolean(id),
  });
  const repayments = useQuery({
    queryKey: ['loan-repayments', id],
    queryFn: () => getLoanRepayments(id),
    enabled: Boolean(id),
  });
  const decision = useMutation({
    mutationFn: ({
      repaymentId,
      action,
    }: {
      repaymentId: string;
      action: 'confirm' | 'dispute' | 'cancel';
    }) => decideRepayment(repaymentId, action, makeIdempotencyKey()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loan-room', id] });
      void queryClient.invalidateQueries({ queryKey: ['loan-repayments', id] });
      void queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
    onError: () => Alert.alert(t('appName'), t('loan.somethingWentWrong')),
  });
  if (room.isLoading)
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color="#1D4ED8" style={styles.loader} />
      </SafeAreaView>
    );
  if (!room.data)
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>{t('loan.somethingWentWrong')}</Text>
      </SafeAreaView>
    );
  const loan = room.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('loan.loanRoom')}</Text>
        <Text style={styles.balance}>
          {formatMoneyMinor(loan.balance_minor, loan.currency, i18n.language)}
        </Text>
        <Text style={styles.caption}>
          {t('loan.remaining')} · {loan.status}
        </Text>
        {loan.status === 'ACTIVE' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/loan/${id}/repayment`)}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{t('loan.recordRepayment')}</Text>
          </Pressable>
        )}
        <View style={styles.card}>
          <Text style={styles.label}>{loan.purpose || t('loan.sharedLoan')}</Text>
          <Text style={styles.meta}>
            {t('loan.amount')}:{' '}
            {formatMoneyMinor(loan.principal_minor, loan.currency, i18n.language)}
            {'\n'}
            {t('loan.loanDate')}: {formatDate(loan.loan_date, i18n.language)}
            {'\n'}
            {t('loan.dueDate')}: {formatDate(loan.due_date, i18n.language)}
          </Text>
        </View>
        <Text style={styles.section}>{t('loan.members')}</Text>
        <View style={styles.card}>
          {loan.members.map((member) => (
            <Text key={member.role} style={styles.meta}>
              {member.role === 'LENDER' ? t('loan.lender') : t('loan.borrower')}:{' '}
              {member.display_name || '—'}
            </Text>
          ))}
        </View>
        <Text style={styles.section}>{t('loan.repayments')}</Text>
        <View style={styles.card}>
          {repayments.isLoading ? (
            <ActivityIndicator color="#1D4ED8" />
          ) : repayments.data?.length ? (
            repayments.data.map((repayment) => {
              const own = repayment.created_by === session?.user.id;
              return (
                <View key={repayment.id} style={styles.event}>
                  <Text style={styles.label}>
                    {formatMoneyMinor(repayment.amount_minor, loan.currency, i18n.language)} ·{' '}
                    {loanStatusLabel(repayment.status, t)}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDate(repayment.payment_date, i18n.language)}
                    {repayment.note ? ` · ${repayment.note}` : ''}
                  </Text>
                  {repayment.status === 'PENDING' && (
                    <View style={styles.actions}>
                      {own ? (
                        <Action
                          label={t('loan.cancel')}
                          onPress={() =>
                            decision.mutate({ repaymentId: repayment.id, action: 'cancel' })
                          }
                        />
                      ) : (
                        <>
                          <Action
                            label={t('loan.confirmRepayment')}
                            onPress={() =>
                              decision.mutate({ repaymentId: repayment.id, action: 'confirm' })
                            }
                          />
                          <Action
                            label={t('loan.dispute')}
                            onPress={() =>
                              decision.mutate({ repaymentId: repayment.id, action: 'dispute' })
                            }
                          />
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.meta}>—</Text>
          )}
        </View>
        <Text style={styles.section}>{t('loan.timeline')}</Text>
        <View style={styles.card}>
          {loan.timeline.length ? (
            loan.timeline.map((event) => (
              <View key={event.id} style={styles.event}>
                <Text style={styles.label}>{loanEventLabel(event.event_type, t)}</Text>
                <Text style={styles.meta}>
                  {new Date(event.created_at).toLocaleString(i18n.language)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>—</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { padding: 24, gap: 16 },
  loader: { marginTop: 48 },
  error: { padding: 24, color: '#B42318' },
  eyebrow: { color: '#1D4ED8', fontWeight: '700' },
  balance: { fontSize: 32, fontWeight: '700', color: '#101828', marginTop: 4 },
  caption: { color: '#667085' },
  section: { color: '#344054', fontWeight: '700', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  label: { color: '#101828', fontWeight: '700' },
  meta: { color: '#667085', lineHeight: 21 },
  event: { gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  primary: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  actionText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
});
