import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

import { getCurrentSession, onAuthStateChange } from '@/lib/auth';
import { captureException } from '@/lib/monitoring';
import { useAuthStore } from '@/stores/auth-store';
import { getMyLocale } from '@/features/preferences/api';
import i18n from '@/i18n';

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const syncSession = async (session: Awaited<ReturnType<typeof getCurrentSession>>) => {
      setSession(session);
      if (session) await i18n.changeLanguage(await getMyLocale());
    };

    void getCurrentSession()
      .then(syncSession)
      .catch((error: unknown) => captureException(error, { feature: 'auth_session_bootstrap' }))
      .finally(setHydrated);

    const { data } = onAuthStateChange((_event, session) => {
      void syncSession(session).catch((error: unknown) =>
        captureException(error, { feature: 'auth_locale_sync' }),
      );
    });
    return () => data.subscription.unsubscribe();
  }, [setHydrated, setSession]);

  return children;
}
