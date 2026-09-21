import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStorage } from './session-storage.native';
const mock = vi.hoisted(() => ({
  values: new Map<string, string>(),
  counter: 0,
  failChunk: false,
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: async (_algorithm: string, key: string) => key,
  randomUUID: () => `00000000-0000-4000-8000-${String(++mock.counter).padStart(12, '0')}`,
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async (key: string) => mock.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (mock.failChunk && key.endsWith('.1')) throw new Error('write failed');
    mock.values.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mock.values.delete(key);
  },
}));
beforeEach(() => {
  mock.values.clear();
  mock.counter = 0;
  mock.failChunk = false;
});
describe('native encrypted session chunk storage', () => {
  it('round-trips large Unicode sessions using small native values and removes all chunks', async () => {
    const value = JSON.stringify({
      token: 'synthetic'.repeat(700),
      name: '😀 tiếng Việt'.repeat(400),
    });
    await sessionStorage.setItem('session', value);
    expect(await sessionStorage.getItem('session')).toBe(value);
    expect(
      [...mock.values.values()].every((entry) => Buffer.byteLength(entry, 'utf8') < 2048),
    ).toBe(true);
    await sessionStorage.removeItem('session');
    expect(mock.values.size).toBe(0);
    expect(await sessionStorage.getItem('session')).toBeNull();
  });
  it('keeps the previous committed session if a chunk write fails', async () => {
    await sessionStorage.setItem('session', 'old');
    mock.failChunk = true;
    await expect(sessionStorage.setItem('session', 'x'.repeat(1000))).rejects.toThrow(
      'write failed',
    );
    expect(await sessionStorage.getItem('session')).toBe('old');
    expect(mock.values.size).toBe(2);
  });
  it('fails closed for incomplete or malformed storage', async () => {
    await sessionStorage.setItem('session', 'valid');
    for (const key of mock.values.keys()) if (key.endsWith('.0')) mock.values.delete(key);
    expect(await sessionStorage.getItem('session')).toBeNull();
    mock.values.set('loan.session', '{broken');
    expect(await sessionStorage.getItem('session')).toBeNull();
  });
});
