import { afterEach, describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/auth-store';
import { accountKey, runForCurrentAccount, runAccountRpc } from './account-boundary';
import { createAccountQueryClient, disposeAccountQueryClient } from './account-query-client';

const session = (id: string) => ({ user: { id }, access_token: `synthetic-${id}` }) as Session;
afterEach(() => useAuthStore.getState().setSession(null));
describe('account isolation', () => {
  it('pins A credentials before an asynchronous request can observe account B', async () => {
    useAuthStore.getState().setSession(session('A'));
    let header = '';
    let finish!: () => void;
    const request = new Promise<string>((resolve) => {
      finish = () => resolve('old response');
    });
    const builder = Object.assign(request, {
      setHeader(name: string, value: string) {
        expect(name).toBe('Authorization');
        header = value;
        useAuthStore.getState().setSession(session('B'));
        return request;
      },
    });
    const operation = runAccountRpc(() => builder);
    const assertion = expect(operation).rejects.toThrow('SESSION_CHANGED');
    expect(header).toBe('Bearer synthetic-A');
    finish();
    await assertion;
  });
  it('never returns A data when B asks for the same resource', async () => {
    const a = createAccountQueryClient();
    a.setQueryData(accountKey('A', 'loans'), ['private-A']);
    const b = createAccountQueryClient();
    expect(
      await b.fetchQuery({
        queryKey: accountKey('B', 'loans'),
        queryFn: async () => ['private-B'],
      }),
    ).toEqual(['private-B']);
    expect(b.getQueryData(accountKey('A', 'loans'))).toBeUndefined();
    disposeAccountQueryClient(a);
    disposeAccountQueryClient(b);
  });
  it('discards a mutation response after switching accounts, even A -> B -> A', async () => {
    useAuthStore.getState().setSession(session('A'));
    let finish!: (value: string) => void;
    const operation = runForCurrentAccount(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const assertion = expect(operation).rejects.toThrow('SESSION_CHANGED');
    useAuthStore.getState().setSession(session('B'));
    useAuthStore.getState().setSession(session('A'));
    finish('old response');
    await assertion;
  });
  it('clears and cancels old queries before late responses arrive', async () => {
    const client = createAccountQueryClient();
    let finish!: (value: string[]) => void;
    const pending = client
      .fetchQuery({
        queryKey: accountKey('A', 'loans'),
        queryFn: () =>
          new Promise<string[]>((resolve) => {
            finish = resolve;
          }),
      })
      .catch(() => undefined);
    disposeAccountQueryClient(client);
    finish(['private-A']);
    await pending;
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('blocks unauthenticated operations and preserves an in-flight request on token refresh', async () => {
    useAuthStore.getState().setSession(null);
    await expect(runForCurrentAccount(async () => 'data')).rejects.toThrow(
      'AUTHENTICATION_REQUIRED',
    );
    useAuthStore.getState().setSession(session('A'));
    expect(
      await runForCurrentAccount(async () => {
        useAuthStore.getState().setSession(session('A'));
        return 'same user';
      }),
    ).toBe('same user');
  });
});
