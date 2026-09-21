import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoan, getMyPendingInvites, getPendingInviteDetail, respondToInvite } from './api';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  state: { session: { user: { id: 'user-a' } } },
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: (name: string, args: unknown) => mocks.rpc(name, args),
  }),
}));

vi.mock('@/lib/account-boundary', () => ({
  runAccountRpc: async <T>(fn: () => Promise<T>) => fn(),
}));

describe('pending invites api layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes recipient_email_input to create_loan RPC when provided', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { loan_id: 'loan-1', invite_token: 'token-1', status: 'PENDING' },
      error: null,
    });

    const result = await createLoan({
      creatorRole: 'LENDER',
      principalMinor: 100000,
      currency: 'VND',
      loanDate: '2026-09-21',
      dueDate: '2026-10-21',
      purpose: 'Mua sắm',
      recipientEmail: 'Friend@Example.COM',
      idempotencyKey: 'a4000000-0000-4000-8000-000000000001',
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'create_loan',
      expect.objectContaining({
        recipient_email_input: 'friend@example.com',
        creator_role_input: 'LENDER',
        principal_minor_input: 100000,
        currency_input: 'VND',
      }),
    );
    expect(result.loan_id).toBe('loan-1');
  });

  it('calls get_my_pending_invites RPC', async () => {
    const mockInvites = [
      {
        loan_id: 'loan-1',
        principal_minor: 50000,
        currency: 'VND',
        loan_date: '2026-09-21',
        due_date: '2026-10-21',
        purpose: 'Cà phê',
        note: null,
        my_role: 'BORROWER',
        creator_name: 'Nguyen Van A',
        invited_at: '2026-09-21T10:00:00Z',
      },
    ];
    mocks.rpc.mockResolvedValueOnce({ data: mockInvites, error: null });

    const data = await getMyPendingInvites();
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_pending_invites', undefined);
    expect(data).toEqual(mockInvites);
  });

  it('calls get_pending_invite_detail RPC with loan_id_input', async () => {
    const mockDetail = {
      loan_id: 'loan-1',
      principal_minor: 50000,
      currency: 'VND',
      loan_date: '2026-09-21',
      due_date: '2026-10-21',
      purpose: 'Cà phê',
      note: 'Trả sớm nhé',
      my_role: 'BORROWER',
      creator_name: 'Nguyen Van A',
      invited_at: '2026-09-21T10:00:00Z',
    };
    mocks.rpc.mockResolvedValueOnce({ data: mockDetail, error: null });

    const data = await getPendingInviteDetail('loan-1');
    expect(mocks.rpc).toHaveBeenCalledWith('get_pending_invite_detail', {
      loan_id_input: 'loan-1',
    });
    expect(data).toEqual(mockDetail);
  });

  it('calls respond_to_invite RPC with decision and idempotency key', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { loan_id: 'loan-1', status: 'ACTIVE' },
      error: null,
    });

    const result = await respondToInvite('loan-1', 'accept', 'idemp-key-1');
    expect(mocks.rpc).toHaveBeenCalledWith('respond_to_invite', {
      loan_id_input: 'loan-1',
      decision_input: 'accept',
      idempotency_key_input: 'idemp-key-1',
    });
    expect(result.status).toBe('ACTIVE');
  });

  it('handles decline decision via respond_to_invite', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { loan_id: 'loan-1', status: 'DECLINED' },
      error: null,
    });

    const result = await respondToInvite('loan-1', 'decline', 'idemp-key-2');
    expect(mocks.rpc).toHaveBeenCalledWith('respond_to_invite', {
      loan_id_input: 'loan-1',
      decision_input: 'decline',
      idempotency_key_input: 'idemp-key-2',
    });
    expect(result.status).toBe('DECLINED');
  });
});
