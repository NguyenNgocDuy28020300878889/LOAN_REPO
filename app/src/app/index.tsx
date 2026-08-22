import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { getMyLoans } from '@/features/loans/api';
import { useLoanRealtime } from '@/features/loans/use-loan-realtime';
import { formatMoneyMinor } from '@/lib/format';
import { loanStatusLabel } from '@/i18n/loan-labels';
import { useAuthStore } from '@/stores/auth-store';

export default function HomeScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const loans = useQuery({ queryKey: ['loans'], queryFn: getMyLoans, enabled: Boolean(session) });
  useLoanRealtime(loans.data?.map((loan) => loan.id) ?? []);
  const openCreate = () => router.push(session ? '/create' : '/auth');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loans.isRefetching} onRefresh={() => void loans.refetch()} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('appName')}</Text>
            <Text style={styles.title}>{t('loan.myLoans')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              style={styles.settings}
            >
              <Text style={styles.settingsText}>⚙</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openCreate} style={styles.add}>
              <Text style={styles.addText}>+</Text>
            </Pressable>
          </View>
        </View>
        {!session ? (
          <Empty
            text={t('loan.signInRequired')}
            action={t('auth.signIn')}
            onPress={() => router.push('/auth')}
          />
        ) : loans.isLoading ? (
          <ActivityIndicator color="#1D4ED8" />
        ) : loans.data?.length ? (
          loans.data.map((loan) => (
            <Pressable
              key={loan.id}
              accessibilityRole="button"
              onPress={() => router.push(`/loan/${loan.id}`)}
              style={styles.card}
            >
              <Text style={styles.amount}>
                {formatMoneyMinor(loan.balance_minor, loan.currency, i18n.language)}
              </Text>
              <Text style={styles.meta}>{loan.purpose || t('loan.sharedLoan')}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.status}>{loanStatusLabel(loan.status, t)}</Text>
                <Text style={styles.meta}>
                  {t('loan.dueDate')}: {loan.due_date}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Empty text={t('loan.empty')} action={t('loan.create')} onPress={openCreate} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.primary}>
        <Text style={styles.primaryText}>{action}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { padding: 24, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: { color: '#1D4ED8', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#101828', marginTop: 4 },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
  },
  addText: { color: '#fff', fontSize: 28, fontWeight: '400' },
  headerActions: { flexDirection: 'row', gap: 8 },
  settings: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  settingsText: { color: '#1D4ED8', fontSize: 22 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 8 },
  amount: { fontSize: 24, fontWeight: '700', color: '#101828' },
  meta: { color: '#667085', fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  status: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 16, backgroundColor: '#fff', padding: 32, borderRadius: 16 },
  emptyText: { textAlign: 'center', color: '#667085', lineHeight: 22 },
  primary: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
