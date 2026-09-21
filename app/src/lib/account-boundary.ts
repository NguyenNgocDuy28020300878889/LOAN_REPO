import { useAuthStore } from '@/stores/auth-store';
import type { Session } from '@supabase/supabase-js';

export async function runForCurrentAccount<T>(
  operation: (session: Session) => PromiseLike<T>,
): Promise<T> {
  const before = useAuthStore.getState();
  if (!before.session) throw new Error('AUTHENTICATION_REQUIRED');
  const result = await operation(before.session);
  if (useAuthStore.getState().sessionEpoch !== before.sessionEpoch) {
    throw new Error('SESSION_CHANGED');
  }
  return result;
}

export function runAccountRpc<T>(
  operation: () => PromiseLike<T> & { setHeader(name: string, value: string): PromiseLike<T> },
): Promise<T> {
  // supabase-js resolves its mutable auth session asynchronously. Pin the
  // original JWT so a queued A request can never be sent with B's credentials.
  return runForCurrentAccount((session) =>
    operation().setHeader('Authorization', `Bearer ${session.access_token}`),
  );
}

export const accountKey = (userId: string | undefined, ...parts: string[]) =>
  ['account', userId ?? 'signed-out', ...parts] as const;
