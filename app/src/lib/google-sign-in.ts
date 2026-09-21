import * as WebBrowser from 'expo-web-browser';
import { completeAuthCallback, startGoogleSignIn } from '@/lib/auth';
import { env } from '@/lib/env';

// Use the installed app scheme, not an Expo Go URL, so each environment is isolated.
export async function signInWithGoogle(returnTo?: string): Promise<string | null> {
  if (!env.googleAuthReady) throw new Error('GOOGLE_AUTH_NOT_CONFIGURED');
  const scheme = env.appEnv === 'production' ? 'loan' : `loan-${env.appEnv}`;
  const redirectTo = `${scheme}://auth/callback`;
  const url = await startGoogleSignIn(redirectTo, returnTo);
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== 'success') return null;
  const completion = await completeAuthCallback(result.url);
  return completion.returnTo;
}
