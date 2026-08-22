import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getSupabaseClient } from '@/lib/supabase';

export function useLoanRealtime(loanIds: string[]) {
  const queryClient = useQueryClient();
  const joinedIds = loanIds.join(',');

  useEffect(() => {
    if (!loanIds.length) return;
    const client = getSupabaseClient();
    const channels = loanIds.map((loanId) => {
      const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['loans'] });
        void queryClient.invalidateQueries({ queryKey: ['loan-room', loanId] });
      };
      return client
        .channel(`loan-room:${loanId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loans', filter: `id=eq.${loanId}` },
          invalidate,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loan_members', filter: `loan_id=eq.${loanId}` },
          invalidate,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'repayments', filter: `loan_id=eq.${loanId}` },
          invalidate,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'loan_events', filter: `loan_id=eq.${loanId}` },
          invalidate,
        )
        .subscribe();
    });
    return () => {
      void Promise.all(channels.map((channel) => client.removeChannel(channel)));
    };
  }, [joinedIds, queryClient, loanIds]);
}
