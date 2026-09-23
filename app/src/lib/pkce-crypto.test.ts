import { describe, expect, it, vi } from 'vitest';
import { installPkceWebCrypto, type IntegerArray } from './pkce-crypto';

describe('native PKCE WebCrypto adapter', () => {
  it('installs secure randomness and SHA-256 without replacing an existing crypto object', async () => {
    const crypto = {};
    const target = { crypto } as typeof globalThis;
    const digest = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
    const getRandomValues = <T extends IntegerArray>(array: T) => {
      array.fill(7);
      return array;
    };

    expect(installPkceWebCrypto(target, 'android', { digest, getRandomValues })).toBe(true);
    const values = target.crypto.getRandomValues(new Uint32Array(2));
    const result = await target.crypto.subtle.digest('SHA-256', new Uint8Array([9]));

    expect(target.crypto).toBe(crypto);
    expect(values).toEqual(new Uint32Array([7, 7]));
    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]));
    await expect(target.crypto.subtle.digest('SHA-1', new Uint8Array([9]))).rejects.toThrow(
      'UNSUPPORTED_DIGEST',
    );
  });

  it('preserves browser and complete native WebCrypto implementations', () => {
    const digest = vi.fn(async () => new ArrayBuffer(0));
    const getRandomValues = <T extends IntegerArray>(array: T) => array;
    const web = {} as typeof globalThis;
    expect(installPkceWebCrypto(web, 'web', { digest, getRandomValues })).toBe(false);
    expect(web.crypto).toBeUndefined();

    const native = {
      crypto: { subtle: { digest }, getRandomValues },
    } as unknown as typeof globalThis;
    expect(installPkceWebCrypto(native, 'android', { digest, getRandomValues })).toBe(false);
    expect(native.crypto.subtle.digest).toBe(digest);
  });
});
