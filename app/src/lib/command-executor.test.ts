import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCommandExecutor } from './command-executor';
function fixture() {
  const values = new Map<string, string>();
  const actor = { userId: 'A', epoch: 1 };
  const deps = {
    storage: {
      getItem: async (k: string) => values.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: async (k: string) => {
        values.delete(k);
      },
    },
    hash: async (v: string) => createHash('sha256').update(v).digest('hex'),
    uuid: randomUUID,
    identity: () => ({ ...actor }),
  };
  return { values, actor, deps };
}
describe('explicit command retries', () => {
  it('reuses the persisted key after lost response and a component/app restart', async () => {
    const { deps, values } = fixture();
    let original = '';
    await expect(
      createCommandExecutor(deps).run('submit', { amount: 100 }, async (key) => {
        original = key;
        throw new Error('lost response');
      }),
    ).rejects.toThrow('lost response');
    expect(values.size).toBe(1);
    expect([...values.values()]).toEqual([original]);
    const result = await createCommandExecutor(deps).run(
      'submit',
      { amount: 100 },
      async (key) => key,
    );
    expect(result).toBe(original);
    expect(values.size).toBe(0);
  });
  it('coalesces double taps and keeps a successful receipt for the current form', async () => {
    const { deps } = fixture();
    const executor = createCommandExecutor(deps);
    let calls = 0;
    const send = async (key: string) => {
      calls++;
      return key;
    };
    const [a, b] = await Promise.all([
      executor.run('create', { amount: 100 }, send),
      executor.run('create', { amount: 100 }, send),
    ]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(await executor.run('create', { amount: 100 }, send)).toBe(a);
    expect(calls).toBe(1);
  });
  it('gives changed payloads and different users separate keys', async () => {
    const { deps, actor } = fixture();
    const executor = createCommandExecutor(deps);
    const a = await executor.run('submit', { amount: 100 }, async (k) => k);
    const b = await executor.run('submit', { amount: 200 }, async (k) => k);
    actor.userId = 'B';
    actor.epoch++;
    const c = await executor.run('submit', { amount: 100 }, async (k) => k);
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it('permits a new identical proposal only after the previous success is acknowledged', async () => {
    const { deps } = fixture();
    const executor = createCommandExecutor(deps);
    const send = async (key: string) => key;
    const first = await executor.run('submit', { amount: 100 }, send);
    expect(await executor.run('submit', { amount: 100 }, send)).toBe(first);
    executor.clearCompleted();
    expect(await executor.run('submit', { amount: 100 }, send)).not.toBe(first);
  });
  it('does not send an old user command after an account switch during storage work', async () => {
    const { deps, actor } = fixture();
    let calls = 0;
    deps.storage.setItem = async () => {
      actor.userId = 'B';
      actor.epoch++;
    };
    await expect(
      createCommandExecutor(deps).run('submit', { amount: 100 }, async () => {
        calls++;
      }),
    ).rejects.toThrow('SESSION_CHANGED');
    expect(calls).toBe(0);
  });
});
