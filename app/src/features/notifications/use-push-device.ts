import { useQuery } from '@tanstack/react-query';
import { accountKey } from '@/lib/account-boundary';
import { useAuthStore } from '@/stores/auth-store';
import { syncPushDevice } from './device';

export function usePushDevice() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: accountKey(userId, 'push-device'),
    queryFn: () => syncPushDevice(),
    enabled: Boolean(userId),
    retry: false,
    staleTime: 60000,
  });
}
