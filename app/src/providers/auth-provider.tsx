import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { getCurrentSession, onAuthStateChange } from '@/lib/auth';
import { captureException } from '@/lib/monitoring';
import { useAuthStore } from '@/stores/auth-store';
import { getMyLocale } from '@/features/preferences/api';
import i18n from '@/i18n';
import { getSupabaseClient } from '@/lib/supabase';

export function AuthProvider({ children }: PropsWithChildren) {
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const auth = getSupabaseClient().auth;
    const update = (state: string) => {
      if (state === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => {
      subscription.remove();
      void auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const syncSession = (session: Awaited<ReturnType<typeof getCurrentSession>>) => {
      if (!active) return;
      const currentRevision = ++revision;
      setSession(session);
      setHydrated();
      // Leave the Supabase auth callback before making another authenticated request.
      if (session)
        setTimeout(() => {
          if (!active || currentRevision !== revision) return;
          void getMyLocale()
            .then((locale) => {
              if (active && currentRevision === revision) void i18n.changeLanguage(locale);
            })
            .catch(() => {
              /* Locale failure must not block authentication. */
            });
        }, 0);
    };

    void getCurrentSession()
      .then((session) => {
        if (active && revision === 0) syncSession(session);
      })
      .catch((error: unknown) => captureException(error, { feature: 'auth_session_bootstrap' }))
      .finally(() => {
        if (active) setHydrated();
      });

    const { data } = onAuthStateChange((_event, session) => {
      syncSession(session);
    });
    return () => {
      active = false;
      revision++;
      data.subscription.unsubscribe();
    };
  }, [setHydrated, setSession]);

  return children;
}
