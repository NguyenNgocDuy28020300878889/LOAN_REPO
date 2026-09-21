import { describe, expect, it, vi } from 'vitest';
import { notificationLoanId } from './payload';
import {
  ProviderError,
  pushMessage,
  runPushWorker,
  type PushJob,
} from '../../../supabase/functions/push-worker/core';

const job: PushJob = {
  id: 'job',
  lease_id: 'lease',
  token: 'ExpoPushToken[test]',
  kind: 'DUE_TODAY',
  loan_id: '94000000-0000-4000-8000-000000000001',
  user_id: 'recipient',
  locale: 'vi',
  ticket_id: null,
};
function setup(receipts = false) {
  const finish = vi.fn();
  const authorize = vi.fn().mockResolvedValue(true);
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'claim_push_work')
      return args.receipts_input === receipts
        ? [{ ...job, ticket_id: receipts ? 'ticket' : null }]
        : [];
    if (name === 'authorize_push_send') return authorize();
    if (name === 'finish_push_work') return finish(args);
    return 0;
  });
  return { rpc, finish, authorize };
}
describe('push boundaries', () => {
  it('retries an explicit provider rate-limit receipt', async () => {
    const { rpc, finish } = setup(true);
    await runPushWorker(rpc, async () => ({
      data: { ticket: { status: 'error', details: { error: 'MessageRateExceeded' } } },
    }));
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome_input: 'retry', error_input: 'MessageRateExceeded' }),
    );
  });
  it('rejects another account and external or malformed paths', () => {
    expect(notificationLoanId({ userId: 'recipient', loanId: job.loan_id }, 'recipient')).toBe(
      job.loan_id,
    );
    expect(notificationLoanId({ userId: 'other', loanId: job.loan_id }, 'recipient')).toBeNull();
    expect(
      notificationLoanId({ userId: 'recipient', loanId: 'https://example.com' }, 'recipient'),
    ).toBeNull();
    expect(notificationLoanId(null, 'recipient')).toBeNull();
  });
  it('sends only generic lock screen content and a short provider TTL', () => {
    const message = pushMessage(job);
    expect(message.data.userId).toBe('recipient');
    expect(message.ttl).toBe(120);
    expect(Object.keys(message.data)).toEqual(['loanId', 'userId', 'notificationId']);
    expect(message.body).not.toMatch(/\d/);

    const inviteJob: PushJob = { ...job, kind: 'INVITE_RECEIVED' };
    const inviteMessage = pushMessage(inviteJob);
    expect(inviteMessage.body).not.toMatch(/\d/);
    expect(inviteMessage.body).toContain('lời mời');
  });
  it('distinguishes ticket acceptance from delivery', async () => {
    const { rpc, finish } = setup();
    const result = await runPushWorker(rpc, async () => ({ data: { status: 'ok', id: 'ticket' } }));
    expect(result).toMatchObject({ accepted: 1, delivered: 0 });
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome_input: 'accepted', ticket_input: 'ticket' }),
    );
  });
  it('checks eligibility again immediately before sending', async () => {
    const { rpc, authorize } = setup();
    authorize.mockResolvedValue(false);
    const transport = vi.fn();
    expect((await runPushWorker(rpc, transport)).cancelled).toBe(1);
    expect(transport).not.toHaveBeenCalled();
  });
  it('retries temporary errors and timeouts without storing sensitive provider messages', async () => {
    const { rpc, finish } = setup();
    await runPushWorker(rpc, async () => {
      throw new ProviderError(true);
    });
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome_input: 'retry', error_input: 'ProviderUnavailable' }),
    );
  });
  it('does not retry invalid credentials indefinitely', async () => {
    const { rpc, finish } = setup();
    await runPushWorker(rpc, async () => {
      throw new ProviderError(false);
    });
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ outcome_input: 'failed' }));
  });
  it('waits for missing receipts, without resending a successful ticket', async () => {
    const { rpc, finish } = setup(true);
    const transport = vi.fn().mockResolvedValue({ data: {} });
    await runPushWorker(rpc, transport);
    expect(transport).toHaveBeenCalledWith('getReceipts', { ids: ['ticket'] });
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ outcome_input: 'receipt_wait' }));
  });
  it('records receipt success separately', async () => {
    const { rpc } = setup(true);
    expect(
      (await runPushWorker(rpc, async () => ({ data: { ticket: { status: 'ok' } } }))).delivered,
    ).toBe(1);
  });
  it('invalidates unregistered devices from receipts', async () => {
    const { rpc, finish } = setup(true);
    await runPushWorker(rpc, async () => ({
      data: { ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } },
    }));
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome_input: 'failed', error_input: 'DeviceNotRegistered' }),
    );
  });
  it('does not treat database errors after a send as retryable provider failures', async () => {
    const { rpc, finish } = setup();
    finish.mockRejectedValue(new Error('Database unavailable'));
    await expect(
      runPushWorker(rpc, async () => ({ data: { status: 'ok', id: 'ticket' } })),
    ).rejects.toThrow('Database unavailable');
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
