import { runAccountRpc } from '@/lib/account-boundary';
import { getSupabaseClient } from '@/lib/supabase';
import { createLoanInputSchema, type CreateLoanInput } from '@/features/loans/validation';

export { createLoanInputSchema, type CreateLoanInput } from '@/features/loans/validation';

export async function createLoan(input: CreateLoanInput) {
  const parsed = createLoanInputSchema.parse(input);
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('create_loan', {
      creator_role_input: parsed.creatorRole,
      principal_minor_input: parsed.principalMinor,
      currency_input: parsed.currency,
      loan_date_input: parsed.loanDate,
      due_date_input: parsed.dueDate,
      purpose_input: parsed.purpose ?? null,
      note_input: parsed.note ?? null,
      idempotency_key_input: parsed.idempotencyKey,
    }),
  );
  if (error) throw error;
  return data as { loan_id: string; invite_token: string | null; status: 'PENDING' };
}

export async function acceptLoanInvite(inviteToken: string, idempotencyKey: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('accept_loan_invite', {
      invite_token_input: inviteToken,
      idempotency_key_input: idempotencyKey,
    }),
  );
  if (error) throw error;
  return data as { loan_id: string; status: 'ACTIVE' };
}

export async function declineLoanInvite(inviteToken: string, idempotencyKey: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('decline_loan_invite', {
      invite_token_input: inviteToken,
      idempotency_key_input: idempotencyKey,
    }),
  );
  if (error) throw error;
  return data as { loan_id: string; status: 'DECLINED' };
}

export async function manageLoanInvite(loanId: string, action: 'rotate' | 'revoke', key: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('manage_loan_invite', {
      loan_id_input: loanId,
      action_input: action,
      idempotency_key_input: key,
    }),
  );
  if (error) throw error;
  return data as { loan_id: string; invite_token: string | null; action: 'rotate' | 'revoke' };
}

export type LoanInvitePreview = {
  loan_id: string;
  principal_minor: number;
  currency: string;
  loan_date: string;
  due_date: string;
  purpose: string | null;
  target_role: 'LENDER' | 'BORROWER';
  expires_at: string;
};

export async function getLoanInvitePreview(inviteToken: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('get_loan_invite_preview', {
      invite_token_input: inviteToken,
    }),
  );
  if (error) throw error;
  return data as LoanInvitePreview;
}

export type LoanSummary = {
  id: string;
  principal_minor: number;
  balance_minor: number;
  currency: string;
  due_date: string;
  status: 'PENDING' | 'ACTIVE' | 'REPAID' | 'CLOSED' | 'DECLINED';
  my_role: 'LENDER' | 'BORROWER';
  purpose: string | null;
};

export type LoanRoom = LoanSummary & {
  loan_date: string;
  note: string | null;
  members: {
    role: 'LENDER' | 'BORROWER';
    membership_status: string;
    display_name: string | null;
  }[];
  timeline: {
    id: string;
    event_type: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
};

export async function getMyLoans() {
  const { data, error } = await runAccountRpc(() => getSupabaseClient().rpc('get_my_loans'));
  if (error) throw error;
  return data as LoanSummary[];
}

export async function getLoanRoom(loanId: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('get_loan_room', {
      loan_id_input: loanId,
    }),
  );
  if (error) throw error;
  return data as LoanRoom;
}

export type Repayment = {
  id: string;
  amount_minor: number;
  payment_date: string;
  method: string | null;
  note: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  created_by: string | null;
  created_at: string;
};
export async function getLoanRepayments(loanId: string) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('get_loan_repayments', {
      loan_id_input: loanId,
    }),
  );
  if (error) throw error;
  return data as Repayment[];
}

export async function submitRepayment(input: {
  loanId: string;
  amountMinor: number;
  paymentDate: string;
  method?: string;
  note?: string;
  idempotencyKey: string;
}) {
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc('submit_repayment', {
      loan_id_input: input.loanId,
      amount_minor_input: input.amountMinor,
      payment_date_input: input.paymentDate,
      method_input: input.method ?? null,
      note_input: input.note ?? null,
      idempotency_key_input: input.idempotencyKey,
    }),
  );
  if (error) throw error;
  return data as { repayment_id: string; status: 'PENDING' };
}

export async function decideRepayment(
  repaymentId: string,
  decision: 'confirm' | 'dispute' | 'cancel',
  idempotencyKey: string,
) {
  const functionName = `${decision}_repayment` as
    'confirm_repayment' | 'dispute_repayment' | 'cancel_repayment';
  const { data, error } = await runAccountRpc(() =>
    getSupabaseClient().rpc(functionName, {
      repayment_id_input: repaymentId,
      idempotency_key_input: idempotencyKey,
    }),
  );
  if (error) throw error;
  return data as {
    repayment_id: string;
    status: 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
    loan_status?: 'ACTIVE' | 'REPAID';
  };
}
