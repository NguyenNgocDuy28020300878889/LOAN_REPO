type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Identity = { userId: string; epoch: number };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function createCommandExecutor(deps: {
  storage: Storage;
  hash(value: string): Promise<string>;
  uuid(): string;
  identity(): Identity | null;
}) {
  const pending = new Map<string, Promise<unknown>>();
  const completed = new Map<string, unknown>();
  return {
    // Call only after the UI acknowledges success, to allow a new deliberate action.
    clearCompleted() {
      completed.clear();
    },
    async run<T>(name: string, payload: unknown, send: (key: string) => Promise<T>): Promise<T> {
      const identity = deps.identity();
      if (!identity) throw new Error('AUTHENTICATION_REQUIRED');
      const assertIdentity = () => {
        const current = deps.identity();
        if (!current || current.userId !== identity.userId || current.epoch !== identity.epoch)
          throw new Error('SESSION_CHANGED');
      };
      const fingerprint = await deps.hash(
        JSON.stringify([identity.userId, name, canonical(payload)]),
      );
      assertIdentity();
      const cacheKey = `${identity.epoch}.${fingerprint}`;
      if (completed.has(cacheKey)) return completed.get(cacheKey) as T;
      if (pending.has(cacheKey)) return pending.get(cacheKey) as Promise<T>;
      const storageKey = `loan.command.${fingerprint}`;
      const attempt = (async () => {
        const saved = await deps.storage.getItem(storageKey);
        if (
          saved &&
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(saved)
        )
          throw new Error('COMMAND_STORAGE_INVALID');
        const key = saved || deps.uuid();
        // Only a random key and a payload digest persist. Never store financial
        // payloads or automatically submit queued operations after reconnect.
        await deps.storage.setItem(storageKey, key);
        assertIdentity();
        const result = await send(key);
        assertIdentity();
        completed.set(cacheKey, result);
        await deps.storage.removeItem(storageKey).catch(() => undefined);
        return result;
      })();
      pending.set(cacheKey, attempt);
      try {
        return await attempt;
      } finally {
        pending.delete(cacheKey);
      }
    },
  };
}
