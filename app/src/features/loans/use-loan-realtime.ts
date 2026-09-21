import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase';
import { accountKey } from '@/lib/account-boundary';
import { useAuthStore } from '@/stores/auth-store';

// Mount once inside the account QueryClient. RLS controls delivery; subscribing
// before the first loan exists also catches membership created on another device.
export function useLoanRealtime() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);
  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseClient();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (!active) return;
      // A transaction can update several tables. Refetch once for that burst.
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (active) void queryClient.invalidateQueries({ queryKey: accountKey(userId) });
      }, 150);
    };
    const channel = client.channel(`loans:${userId}:${Math.random().toString(36).slice(2)}`);
    for (const table of ['loans', 'loan_members', 'repayments', 'loan_events']) {
      // DELETE does not apply row security to old records in Postgres Changes.
      // Deletion semantics are pending a product decision; never subscribe to '*'.
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel.on('postgres_changes', { event, schema: 'public', table }, invalidate);
      }
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') invalidate();
    });
    const lifecycle = AppState.addEventListener('change', (state) => {
      if (state === 'active') invalidate();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      lifecycle.remove();
      void client.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
