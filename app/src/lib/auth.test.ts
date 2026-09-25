import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  exchange: vi.fn(),
  signOut: vi.fn(),
  unregisterPushDevice: vi.fn(),
  clearPushTray: vi.fn(),
  setSession: vi.fn(),
  storage: new Map<string, string>(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  session: null as unknown,
  sessionEpoch: 0,
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithOAuth: mocks.oauth,
      exchangeCodeForSession: mocks.exchange,
      signOut: mocks.signOut,
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      const promise = Promise.resolve(mocks.rpc(name, args));
      return Object.assign(promise, {
        setHeader: vi.fn().mockReturnValue(promise),
      });
    },
    functions: {
      invoke: mocks.invoke,
    },
  }),
}));
vi.mock('@/features/notifications/device', () => ({
  unregisterPushDevice: mocks.unregisterPushDevice,
  clearPushTray: mocks.clearPushTray,
}));
vi.mock('@/lib/session-storage', () => ({
  sessionStorage: {
    getItem: async (key: string) => mocks.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => mocks.storage.set(key, value),
    removeItem: async (key: string) => mocks.storage.delete(key),
  },
}));
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      session: mocks.session,
      sessionEpoch: mocks.sessionEpoch,
      setSession: mocks.setSession,
    }),
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.storage.clear();
  mocks.session = null;
  mocks.sessionEpoch = 0;
  mocks.oauth.mockResolvedValue({ data: { url: 'https://example.supabase.co/auth/v1/authorize' } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.unregisterPushDevice.mockResolvedValue(undefined);
  mocks.clearPushTray.mockResolvedValue(undefined);
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

describe('sign-out account boundary', () => {
  it('signs out only the current session even when push cleanup fails', async () => {
    const { signOut } = await import('./auth');
    mocks.unregisterPushDevice.mockRejectedValueOnce(new Error('offline'));
    mocks.clearPushTray.mockRejectedValueOnce(new Error('notification service unavailable'));

    await expect(signOut()).resolves.toBeUndefined();

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.setSession).toHaveBeenCalledWith(null);
    expect(mocks.storage.has('loan.auth-flow')).toBe(false);
  });

  it('keeps the account state when Supabase cannot end the session', async () => {
    const { signOut } = await import('./auth');
    mocks.signOut.mockResolvedValueOnce({ error: new Error('network unavailable') });

    await expect(signOut()).rejects.toThrow('network unavailable');

    expect(mocks.setSession).not.toHaveBeenCalledWith(null);
  });
});

describe('account deletion boundary', () => {
  it('loads account deletion state for authenticated user', async () => {
    const { getAccountDeletionState } = await import('./auth');
    mocks.session = { access_token: 'valid-jwt', user: { id: 'u1' } };
    mocks.rpc.mockReturnValueOnce({
      data: {
        eligible: true,
        blocking_loan_count: 0,
        blocking_repayment_count: 0,
        request: null,
      },
      error: null,
    });

    const state = await getAccountDeletionState();
    expect(state.eligible).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_account_deletion_state', undefined);
  });

  it('completes account deletion and cleans up session on success', async () => {
    const { deleteAccount } = await import('./auth');
    mocks.session = { access_token: 'valid-jwt', user: { id: 'u1' } };
    mocks.rpc.mockReturnValueOnce({
      data: { id: 'req-1', status: 'PENDING' },
      error: null,
    });
    mocks.invoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    await deleteAccount();

    expect(mocks.rpc).toHaveBeenCalledWith('request_account_deletion', undefined);
    expect(mocks.invoke).toHaveBeenCalledWith('delete-account', {
      headers: { Authorization: 'Bearer valid-jwt' },
      body: {},
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.setSession).toHaveBeenCalledWith(null);
  });

  it('preserves the session if delete-account edge function fails', async () => {
    const { deleteAccount } = await import('./auth');
    mocks.session = { access_token: 'valid-jwt', user: { id: 'u1' } };
    mocks.rpc.mockReturnValueOnce({
      data: { id: 'req-1', status: 'PENDING' },
      error: null,
    });
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('ACCOUNT_DELETION_FAILED'),
    });

    await expect(deleteAccount()).rejects.toThrow('ACCOUNT_DELETION_FAILED');
    expect(mocks.setSession).not.toHaveBeenCalledWith(null);
  });
});
