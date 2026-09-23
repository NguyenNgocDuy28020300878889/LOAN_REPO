import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import '@/i18n';
import '@/lib/monitoring';
import { AuthProvider } from '@/providers/auth-provider';
import { useAuthStore } from '@/stores/auth-store';
import { createAccountQueryClient, disposeAccountQueryClient } from '@/lib/account-query-client';
import { useLoanRealtime } from '@/features/loans/use-loan-realtime';
import { NotificationObserver } from '@/features/notifications/observer';

function AccountRealtime() {
  useLoanRealtime();
  return null;
}

function NativeQueryFocus() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const update = (status: AppStateStatus) => focusManager.setFocused(status === 'active');
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);
  return null;
}

function AccountQueries({ children }: PropsWithChildren) {
  const [queryClient] = useState(createAccountQueryClient);
  useEffect(() => () => disposeAccountQueryClient(queryClient), [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <AccountRealtime />
      <NotificationObserver />
      {children}
    </QueryClientProvider>
  );
}

function SessionQueries({ children }: PropsWithChildren) {
  const epoch = useAuthStore((state) => state.sessionEpoch);
  return <AccountQueries key={epoch}>{children}</AccountQueries>;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <>
      <NativeQueryFocus />
      <AuthProvider>
        <SessionQueries>{children}</SessionQueries>
      </AuthProvider>
    </>
  );
}
