import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';
import { sessionStorage } from '@/lib/session-storage';
import { parseAuthCode, safeReturnPath } from '@/lib/auth-callback';
import { runForCurrentAccount, runAccountRpc } from '@/lib/account-boundary';
import { useAuthStore } from '@/stores/auth-store';
import { env } from '@/lib/env';
import { unregisterPushDevice, clearPushTray } from '@/features/notifications/device';

type AuthFlow = {
  kind: 'oauth' | 'signup' | 'recovery';
  redirectTo: string;
  returnTo: string;
  createdAt: number;
};
type AuthCompletion = { returnTo: string; recovery: boolean };
const flowKey = 'loan.auth-flow';
let lastExchange:
  | { code: string; redirectTo: string; result: Promise<AuthCompletion>; startedAt: number }
  | undefined;
let recovery: { userId: string; expiresAt: number } | undefined;
async function beginFlow(kind: AuthFlow['kind'], redirectTo: string, returnTo: unknown = '/') {
  await sessionStorage.setItem(
    flowKey,
    JSON.stringify({
      kind,
      redirectTo,
      returnTo: safeReturnPath(returnTo),
      createdAt: Date.now(),
    } satisfies AuthFlow),
  );
}

export async function getCurrentSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return getSupabaseClient().auth.onAuthStateChange(callback);
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  redirectTo: string,
  returnTo?: string,
) {
  await beginFlow('signup', redirectTo, returnTo);
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function startGoogleSignIn(redirectTo: string, returnTo?: string) {
  await beginFlow('oauth', redirectTo, returnTo);
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) {
    await sessionStorage.removeItem(flowKey);
    throw error ?? new Error('GOOGLE_AUTH_URL_MISSING');
  }
  return data.url;
}

export async function completeAuthCallback(callbackUrl: string): Promise<AuthCompletion> {
  // One exchange if the native browser result and router callback arrive together.
  const rawCode = new URL(callbackUrl).searchParams.get('code');
  if (rawCode && lastExchange?.code === rawCode && Date.now() - lastExchange.startedAt < 60_000) {
    parseAuthCode(callbackUrl, lastExchange.redirectTo);
    return lastExchange.result;
  }
  const raw = await sessionStorage.getItem(flowKey);
  if (!raw) throw new Error('AUTH_FLOW_MISSING');
  const flow = JSON.parse(raw) as AuthFlow;
  if (
    !Number.isFinite(flow.createdAt) ||
    Date.now() - flow.createdAt > 3_600_000 ||
    flow.createdAt > Date.now()
  )
    throw new Error('AUTH_FLOW_EXPIRED');
  const code = parseAuthCode(callbackUrl, flow.redirectTo);
  if (lastExchange?.code === code && Date.now() - lastExchange.startedAt < 60_000)
    return lastExchange.result;
  const result = (async () => {
    const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
    if (error || !data.session) throw error ?? new Error('AUTH_SESSION_MISSING');
    useAuthStore.getState().setSession(data.session);
    const isRecovery =
      flow.kind === 'recovery' && 'redirectType' in data && data.redirectType === 'recovery';
    recovery = isRecovery
      ? { userId: data.session.user.id, expiresAt: Date.now() + 15 * 60_000 }
      : undefined;
    await sessionStorage.removeItem(flowKey);
    return { returnTo: safeReturnPath(flow.returnTo), recovery: isRecovery };
  })();
  lastExchange = { code, redirectTo: flow.redirectTo, result, startedAt: Date.now() };
  return result;
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  await beginFlow('recovery', redirectTo);
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function resendSignupConfirmation(
  email: string,
  redirectTo: string,
  returnTo?: string,
) {
  await beginFlow('signup', redirectTo, returnTo);
  const { error } = await getSupabaseClient().auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export function hasPasswordRecovery() {
  return Boolean(
    recovery &&
    recovery.userId === useAuthStore.getState().session?.user.id &&
    recovery.expiresAt > Date.now(),
  );
}

export async function updateRecoveredPassword(password: string) {
  if (!hasPasswordRecovery()) throw new Error('PASSWORD_RECOVERY_REQUIRED');
  if (password.length < 12) throw new Error('INVALID_PASSWORD');
  // Capture the recovery JWT instead of resolving a potentially different
  // account from the shared Auth client's queue when this request runs.
  await runForCurrentAccount(async (session) => {
    const response = await fetch(`${env.supabase.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: env.supabase.publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error('PASSWORD_UPDATE_FAILED');
  });
  recovery = undefined;
}

export async function signOut() {
  // Push cleanup is best-effort. A stale device binding is also invalidated
  // when the current Auth session is removed, so cleanup failure must never
  // trap a user inside the account they asked to leave.
  await Promise.allSettled([unregisterPushDevice(), clearPushTray()]);
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
  recovery = undefined;
  lastExchange = undefined;
  await sessionStorage.removeItem(flowKey);
  useAuthStore.getState().setSession(null);
}

export async function requestAccountDeletion() {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('request_account_deletion'),
  );
  if (error) throw error;
  return data as AccountDeletionRequest;
}

export type AccountDeletionRequest = {
  id: string;
  requested_at: string;
  updated_at: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
};

export async function getAccountDeletionRequest() {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('get_my_account_deletion_request'),
  );
  if (error) throw error;
  return data as AccountDeletionRequest | null;
}
