import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';

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
    <AuthProvider>
      <SessionQueries>{children}</SessionQueries>
    </AuthProvider>
  );
}
