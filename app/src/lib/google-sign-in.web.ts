import { startGoogleSignIn } from '@/lib/auth';
import { env } from '@/lib/env';

export async function signInWithGoogle(returnTo?: string): Promise<string | null> {
  if (!env.googleAuthReady) throw new Error('GOOGLE_AUTH_NOT_CONFIGURED');
  const redirectTo = `${window.location.origin}/auth/callback`;
  const url = await startGoogleSignIn(redirectTo, returnTo);
  // Same-tab navigation keeps the PKCE verifier on this origin and avoids popup blockers.
  window.location.assign(url);
  return null;
}
