import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// ESLint's Expo resolver maps both paths to web; Vitest intentionally tests both files.
// eslint-disable-next-line import/no-duplicates
import { signInWithGoogle as nativeSignIn } from './google-sign-in';
// eslint-disable-next-line import/no-duplicates
import { signInWithGoogle as webSignIn } from './google-sign-in.web';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  complete: vi.fn(),
  browser: vi.fn(),
  env: { appEnv: 'development', googleAuthReady: true },
}));
vi.mock('@/lib/auth', () => ({
  startGoogleSignIn: mocks.start,
  completeAuthCallback: mocks.complete,
}));
vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: mocks.browser }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.appEnv = 'development';
  mocks.env.googleAuthReady = true;
  mocks.start.mockResolvedValue('https://example.supabase.co/auth/v1/authorize?provider=google');
});
afterEach(() => vi.unstubAllGlobals());

describe('Google browser handoff', () => {
  it('uses the current web origin and same tab, preserving the invitation', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:8082', assign } });
    const invitation = `/invite/${'a'.repeat(64)}`;
    await webSignIn(invitation);
    expect(mocks.start).toHaveBeenCalledWith('http://127.0.0.1:8082/auth/callback', invitation);
    expect(assign).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/authorize?provider=google',
    );
    expect(mocks.browser).not.toHaveBeenCalled();
  });
  it.each(['development', 'staging', 'production'])('isolates native %s callbacks', async (env) => {
    mocks.env.appEnv = env;
    const scheme = env === 'production' ? 'loan' : `loan-${env}`;
    const callback = `${scheme}://auth/callback`;
    mocks.browser.mockResolvedValue({ type: 'success', url: `${callback}?code=valid-code` });
    mocks.complete.mockResolvedValue({ returnTo: '/', recovery: false });
    await expect(nativeSignIn('/')).resolves.toBe('/');
    expect(mocks.start).toHaveBeenCalledWith(callback, '/');
    expect(mocks.browser.mock.calls[0][1]).toBe(callback);
    expect(mocks.complete).toHaveBeenCalledWith(`${callback}?code=valid-code`);
  });
  it('does not exchange a session when the user cancels', async () => {
    mocks.browser.mockResolvedValue({ type: 'cancel' });
    await expect(nativeSignIn()).resolves.toBeNull();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it('does not start either flow when provider configuration is missing', async () => {
    mocks.env.googleAuthReady = false;
    await expect(nativeSignIn()).rejects.toThrow('GOOGLE_AUTH_NOT_CONFIGURED');
    await expect(webSignIn()).rejects.toThrow('GOOGLE_AUTH_NOT_CONFIGURED');
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
