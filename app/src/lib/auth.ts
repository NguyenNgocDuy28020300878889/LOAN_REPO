import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase';

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

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function startGoogleSignIn(redirectTo: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('GOOGLE_AUTH_URL_MISSING');
  return data.url;
}

export async function completeGoogleSignIn(callbackUrl: string) {
  const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(callbackUrl);
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function requestAccountDeletion() {
  const { data, error } = await getSupabaseClient().rpc('request_account_deletion');
  if (error) throw error;
  return data as { id: string; status: 'PENDING' | 'PROCESSING' | 'COMPLETED' };
}
