import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { accountKey } from '@/lib/account-boundary';
import { getMyLoans, type LoanSummary } from '@/features/loans/api';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate, formatMoneyMinor } from '@/lib/format';
import {
  base,
  Brand,
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  Label,
  StatusBadge,
  usePalette,
  selectionKeyProps,
} from '@/components/loan-ui';

const LoanCard = memo(function LoanCard({ loan }: { loan: LoanSummary }) {
  const p = usePalette();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/loan/${loan.id}`)}
      style={({ pressed }) => [
        styles.loan,
        { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.between}>
        <View style={[base.row, { flex: 1 }]}>
          <View style={[styles.roleIcon, { backgroundColor: p.soft }]}>
            <Icon name={loan.my_role === 'LENDER' ? 'arrow-up' : 'arrow-down'} color={p.primary} />
          </View>
          <Text style={[base.fieldLabel, { color: p.muted }]}>
            {t(loan.my_role === 'LENDER' ? 'ui.lending' : 'ui.borrowing')}
          </Text>
        </View>
        <StatusBadge status={loan.status} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[base.title, { color: p.text, fontVariant: ['tabular-nums'] }]}>
          {formatMoneyMinor(loan.balance_minor, loan.currency, i18n.language)}
        </Text>
        <Text style={[base.body, { color: p.text }]} numberOfLines={2}>
          {loan.purpose || t('loan.sharedLoan')}
        </Text>
      </View>
      <View style={[styles.between, { borderTopWidth: 1, borderColor: p.border, paddingTop: 16 }]}>
        <Text style={[base.caption, { color: p.muted, flex: 1 }]}>
          {t('loan.dueDate')}: {formatDate(loan.due_date, i18n.language)}
        </Text>
        <Icon name="forward" size={20} color={p.primary} />
      </View>
    </Pressable>
  );
});

export default function HomeScreen() {
  const p = usePalette();
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [filter, setFilter] = useState<'ALL' | 'LENDER' | 'BORROWER'>('ALL');
  const [search, setSearch] = useState('');
  const loans = useQuery({
    queryKey: accountKey(session?.user.id, 'loans'),
    queryFn: getMyLoans,
    enabled: Boolean(session),
  });
  const { refetch } = loans;
  useFocusEffect(
    useCallback(() => {
      if (session?.user.id) void refetch();
    }, [session?.user.id, refetch]),
  );
  const filtered = useMemo(
    () =>
      loans.data?.filter(
        (loan) =>
          (filter === 'ALL' || loan.my_role === filter) &&
          (loan.purpose || t('loan.sharedLoan'))
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
      ) ?? [],
    [loans.data, filter, search, t],
  );
  const counts = useMemo(
    () => ({
      active: loans.data?.filter((loan) => loan.status === 'ACTIVE').length ?? 0,
      pending: loans.data?.filter((loan) => loan.status === 'PENDING').length ?? 0,
      repaid: loans.data?.filter((loan) => loan.status === 'REPAID').length ?? 0,
    }),
    [loans.data],
  );
  const create = () => router.push(session ? '/create' : '/auth');
  const renderItem = useCallback(({ item }: { item: LoanSummary }) => <LoanCard loan={item} />, []);
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: p.background }}
    >
      <FlatList
        data={session && !loans.isError ? filtered : []}
        keyExtractor={(loan) => loan.id}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[base.page, { gap: 0 }]}
        ItemSeparatorComponent={Separator}
        refreshControl={
          session ? (
            <RefreshControl
              tintColor={p.primary}
              colors={[p.primary]}
              refreshing={loans.isRefetching}
              onRefresh={() => void refetch()}
            />
          ) : undefined
        }
        ListHeaderComponent={
          <View style={{ gap: 24, paddingBottom: 24 }}>
            <View style={styles.between}>
              <Brand />
              <IconButton
                name="settings"
                label={t('settings.title')}
                onPress={() => router.push('/settings')}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={[base.title, { color: p.text }]}>
                {t('loan.myLoans')}
              </Text>
              <Label muted>{t('ui.homeSubtitle')}</Label>
            </View>
            <Button
              kind="secondary"
              label={t('loan.openInvite')}
              onPress={() => router.push('/open-invite')}
            />
            {session && loans.data && !loans.isError && loans.data.length > 0 ? (
              <View style={[styles.overview, { backgroundColor: p.hero }]}>
                <View style={styles.between}>
                  <Text style={[base.fieldLabel, { color: p.heroMuted }]}>{t('ui.overview')}</Text>
                  <Icon name="wallet" color={p.accent} />
                </View>
                <View style={[base.row, { alignItems: 'baseline' }]}>
                  <Text style={[base.amount, { color: p.heroText }]}>{counts.active}</Text>
                  <Text style={[base.body, { color: p.heroText, flexShrink: 1 }]}>
                    {t('ui.activeLoans')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.between,
                    { borderTopWidth: 1, borderColor: '#426454', paddingTop: 16 },
                  ]}
                >
                  <Text style={[base.caption, { color: p.heroMuted }]}>
                    {t('ui.pendingCount', { count: counts.pending })}
                  </Text>
                  <Text style={[base.caption, { color: p.accent }]}>
                    {t('ui.repaidCount', { count: counts.repaid })}
                  </Text>
                </View>
              </View>
            ) : null}
            {session && Boolean(loans.data?.length) && (
              <View style={{ gap: 12 }}>
                <Field
                  label={t('ui.searchLoans')}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('ui.searchPlaceholder')}
                  autoCorrect={false}
                />
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t('ui.filterLoans')}
                  style={[styles.filters, { backgroundColor: p.soft }]}
                >
                  {(['ALL', 'LENDER', 'BORROWER'] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      {...selectionKeyProps(() => setFilter(value))}
                      aria-checked={filter === value}
                      accessibilityState={{ checked: filter === value, selected: filter === value }}
                      onPress={() => setFilter(value)}
                      style={[
                        styles.filter,
                        {
                          backgroundColor: filter === value ? p.surface : 'transparent',
                          borderColor: filter === value ? p.border : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          base.fieldLabel,
                          { color: filter === value ? p.primary : p.muted, textAlign: 'center' },
                        ]}
                      >
                        {t(
                          value === 'ALL'
                            ? 'ui.all'
                            : value === 'LENDER'
                              ? 'ui.lending'
                              : 'ui.borrowing',
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !session ? (
            <Card>
              <View style={[styles.welcomeIcon, { backgroundColor: p.soft }]}>
                <Icon name="wallet" color={p.primary} size={40} />
              </View>
              <Text style={[base.title, { color: p.text }]}>{t('ui.welcomeTitle')}</Text>
              <Label muted>{t('ui.welcomeBody')}</Label>
              <Button
                label={t('auth.signIn')}
                icon="forward"
                onPress={() => router.push('/auth')}
              />
            </Card>
          ) : loans.isLoading ? (
            <ActivityIndicator color={p.primary} accessibilityLabel={t('ui.loading')} />
          ) : loans.isError ? (
            <Card>
              <Label>{t('loan.somethingWentWrong')}</Label>
              <Button
                kind="secondary"
                label={t('settings.tryAgain')}
                onPress={() => void refetch()}
              />
            </Card>
          ) : (
            <Card>
              <View style={[styles.welcomeIcon, { backgroundColor: p.soft }]}>
                <Icon name="document" color={p.primary} size={32} />
              </View>
              <Text style={[base.section, { color: p.text }]}>
                {t(loans.data?.length ? 'ui.noResults' : 'ui.firstLoan')}
              </Text>
              <Label muted>{t(loans.data?.length ? 'ui.adjustSearch' : 'loan.empty')}</Label>
              {Boolean(loans.data?.length) && (
                <Button
                  kind="secondary"
                  label={t('ui.clearFilters')}
                  onPress={() => {
                    setFilter('ALL');
                    setSearch('');
                  }}
                />
              )}
            </Card>
          )
        }
      />
      {session && (
        <View style={[base.footer, { backgroundColor: p.background, borderColor: p.border }]}>
          <View style={base.footerContent}>
            <Button label={t('loan.create')} icon="plus" onPress={create} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
function Separator() {
  return <View style={{ height: 12 }} />;
}
const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  overview: { padding: 24, borderRadius: 24, gap: 16 },
  loan: { borderRadius: 24, borderWidth: 1, padding: 24, gap: 16 },
  roleIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    marginBottom: 8,
  },
  filters: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16 },
  filter: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});
