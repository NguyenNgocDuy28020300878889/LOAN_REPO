import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { env } from '@/lib/env';
import { usePushDevice } from './use-push-device';
import { notificationLoanId } from './payload';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const userId = useAuthStore.getState().session?.user.id;
    const show = Boolean(userId && notificationLoanId(notification.request.content.data, userId));
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
});

export function NotificationObserver() {
  const { refetch } = usePushDevice();
  const session = useAuthStore((state) => state.session);
  const hydrated = useAuthStore((state) => state.isHydrated);
  const navigation = useRootNavigationState();
  const router = useRouter();
  const [pending, setPending] = useState<Notifications.NotificationResponse | null>(null);
  const lastId = useRef<string | null>(null);
  const requestedLogin = useRef(false);
  useEffect(() => {
    if (!env.pushReady) return;
    const received = (response: Notifications.NotificationResponse) => {
      if (response.notification.request.identifier === lastId.current) return;
      lastId.current = response.notification.request.identifier;
      requestedLogin.current = false;
      setPending(response);
    };
    void Notifications.getLastNotificationResponseAsync().then((value) => {
      if (value) received(value);
    });
    const responses = Notifications.addNotificationResponseReceivedListener(received);
    const tokens = Notifications.addPushTokenListener(() => {
      void refetch();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => {
      responses.remove();
      tokens.remove();
      appState.remove();
    };
  }, [refetch]);
  useEffect(() => {
    if (!pending || !navigation?.key || !hydrated) return;
    if (!session) {
      if (!requestedLogin.current) {
        requestedLogin.current = true;
        router.push('/auth');
      }
      return;
    }
    const id = notificationLoanId(pending.notification.request.content.data, session.user.id);
    setPending(null);
    void Notifications.clearLastNotificationResponseAsync();
    if (id) router.push({ pathname: '/loan/[id]', params: { id } });
  }, [pending, session, hydrated, navigation?.key, router]);
  return null;
}
