export type IntegerArray =
  Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array;

type CryptoLike = {
  getRandomValues?: <T extends IntegerArray>(array: T) => T;
  subtle?: {
    digest?: (algorithm: string | { name: string }, data: BufferSource) => Promise<ArrayBuffer>;
  };
};

type CryptoTarget = typeof globalThis & { crypto?: CryptoLike };

export function installPkceWebCrypto(
  target: CryptoTarget,
  platform: string,
  source: {
    digest(data: BufferSource): Promise<ArrayBuffer>;
    getRandomValues<T extends IntegerArray>(array: T): T;
  },
) {
  if (platform === 'web') return false;
  const current = target.crypto;
  if (
    typeof current?.getRandomValues === 'function' &&
    typeof current.subtle?.digest === 'function'
  )
    return false;

  const crypto: CryptoLike = current ?? {};
  crypto.getRandomValues ??= (array) => source.getRandomValues(array);
  crypto.subtle ??= {};
  crypto.subtle.digest ??= (algorithm, data) => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    if (name.toUpperCase() !== 'SHA-256') return Promise.reject(new Error('UNSUPPORTED_DIGEST'));
    return source.digest(data);
  };
  if (!current)
    Object.defineProperty(target, 'crypto', { configurable: true, value: crypto, writable: true });
  return true;
}
