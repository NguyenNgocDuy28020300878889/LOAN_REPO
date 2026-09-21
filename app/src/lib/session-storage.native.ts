import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
type Manifest = { version: 1; generation: string; count: number };
const prefix = async (key: string) =>
  `loan.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key)}`;
function parseManifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value.version === 1 &&
      /^[a-f0-9-]{36}$/.test(value.generation) &&
      Number.isInteger(value.count) &&
      value.count > 0 &&
      value.count <= 128
      ? value
      : null;
  } catch {
    return null;
  }
}
async function removeChunks(base: string, manifest: Manifest | null) {
  if (manifest)
    await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.deleteItemAsync(`${base}.${manifest.generation}.${i}`, options),
      ),
    );
}
// Supabase sessions can exceed one SecureStore value. Commit the encrypted
// manifest after all small encrypted chunks, keeping the old session on failure.
export const sessionStorage = {
  async getItem(key: string) {
    const base = await prefix(key);
    const manifest = parseManifest(await SecureStore.getItemAsync(base, options));
    if (!manifest) return null;
    const chunks = await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.getItemAsync(`${base}.${manifest.generation}.${i}`, options),
      ),
    );
    return chunks.every((part) => part !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    const chars = Array.from(value);
    const chunks = Array.from({ length: Math.max(1, Math.ceil(chars.length / 384)) }, (_, i) =>
      chars.slice(i * 384, (i + 1) * 384).join(''),
    );
    if (chunks.length > 128) throw new Error('SESSION_STORAGE_LIMIT');
    const base = await prefix(key);
    const old = parseManifest(await SecureStore.getItemAsync(base, options));
    const manifest: Manifest = {
      version: 1,
      generation: Crypto.randomUUID(),
      count: chunks.length,
    };
    try {
      for (let i = 0; i < chunks.length; i++)
        await SecureStore.setItemAsync(`${base}.${manifest.generation}.${i}`, chunks[i], options);
      await SecureStore.setItemAsync(base, JSON.stringify(manifest), options);
    } catch (error) {
      await removeChunks(base, manifest).catch(() => undefined);
      throw error;
    }
    await removeChunks(base, old).catch(() => undefined);
  },
  async removeItem(key: string) {
    const base = await prefix(key);
    const old = parseManifest(await SecureStore.getItemAsync(base, options));
    await SecureStore.deleteItemAsync(base, options);
    await removeChunks(base, old);
  },
};
