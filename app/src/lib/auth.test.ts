import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  exchange: vi.fn(),
  setSession: vi.fn(),
  storage: new Map<string, string>(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { signInWithOAuth: mocks.oauth, exchangeCodeForSession: mocks.exchange },
  }),
}));
vi.mock('@/lib/session-storage', () => ({
  sessionStorage: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => mocks.storage.set(key, value),
    removeItem: async (key: string) => mocks.storage.delete(key),
  },
}));
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ setSession: mocks.setSession }) },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.storage.clear();
  mocks.oauth.mockResolvedValue({ data: { url: 'https://example.supabase.co/auth/v1/authorize' } });
});
const redirect = 'http://127.0.0.1:8082/auth/callback';

describe('OAuth PKCE callback boundary', () => {
  it('keeps the invite across redirect and exchanges duplicate native callbacks only once', async () => {
    const { startGoogleSignIn, completeAuthCallback } = await import('./auth');
    const invite = `/invite/${'a'.repeat(64)}`;
    await startGoogleSignIn(redirect, invite);
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: redirect,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    const session = { user: { id: 'synthetic-user' } };
    mocks.exchange.mockResolvedValue({ data: { session }, error: null });
    const results = await Promise.all([
      completeAuthCallback(`${redirect}?code=valid-code`),
      completeAuthCallback(`${redirect}?code=valid-code`),
    ]);
    expect(results).toEqual([
      { returnTo: invite, recovery: false },
      { returnTo: invite, recovery: false },
    ]);
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.setSession).toHaveBeenCalledWith(session);
    expect(mocks.storage.has('loan.auth-flow')).toBe(false);
  });
  it('rejects a callback from the other environment and an unsolicited callback', async () => {
    const { startGoogleSignIn, completeAuthCallback } = await import('./auth');
    await expect(completeAuthCallback(`${redirect}?code=valid-code`)).rejects.toThrow();
    await startGoogleSignIn(redirect);
    await expect(
      completeAuthCallback('http://127.0.0.1:8083/auth/callback?code=valid-code'),
    ).rejects.toThrow();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('does not turn a Google callback into password recovery or an external redirect', async () => {
    const { startGoogleSignIn, completeAuthCallback } = await import('./auth');
    await startGoogleSignIn(redirect, 'https://attacker.invalid');
    mocks.exchange.mockResolvedValue({
      data: { session: { user: { id: 'test' } }, redirectType: 'recovery' },
    });
    await expect(completeAuthCallback(`${redirect}?code=valid-code`)).resolves.toEqual({
      returnTo: '/',
      recovery: false,
    });
  });
  it('rejects expired flows before exchanging credentials', async () => {
    const { startGoogleSignIn, completeAuthCallback } = await import('./auth');
    await startGoogleSignIn(redirect);
    const flow = JSON.parse(mocks.storage.get('loan.auth-flow')!);
    mocks.storage.set(
      'loan.auth-flow',
      JSON.stringify({ ...flow, createdAt: Date.now() - 3_600_001 }),
    );
    await expect(completeAuthCallback(`${redirect}?code=valid-code`)).rejects.toThrow(
      'AUTH_FLOW_EXPIRED',
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('clears a failed start and never stores a session from a failed exchange', async () => {
    const { startGoogleSignIn, completeAuthCallback } = await import('./auth');
    mocks.oauth.mockResolvedValueOnce({ data: { url: null }, error: new Error('provider failed') });
    await expect(startGoogleSignIn(redirect)).rejects.toThrow();
    expect(mocks.storage.has('loan.auth-flow')).toBe(false);
    await startGoogleSignIn(redirect);
    mocks.exchange.mockResolvedValue({ data: { session: null }, error: new Error('invalid code') });
    await expect(completeAuthCallback(`${redirect}?code=valid-code`)).rejects.toThrow();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
});
