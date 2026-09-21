export type PushJob = {
  id: string;
  lease_id: string;
  token: string;
  kind: string;
  loan_id: string;
  user_id: string;
  locale: string;
  ticket_id: string | null;
};
type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type Transport = (path: string, body: unknown) => Promise<unknown>;
type ProviderResult = { status?: string; id?: string; details?: { error?: string } };

export function pushMessage(job: PushJob) {
  const due = job.kind.startsWith('DUE_');
  const vi = job.locale === 'vi';
  return {
    to: job.token,
    title: 'Loan',
    body: vi
      ? due
        ? 'Bạn có khoản vay cần xem lại ngày đến hạn. Mở Loan để xem.'
        : 'Khoản vay của bạn có cập nhật mới. Mở Loan để xem.'
      : due
        ? 'A loan is approaching its due date. Open Loan to review.'
        : 'Your loan has an update. Open Loan to review.',
    data: { loanId: job.loan_id, userId: job.user_id, notificationId: job.id },
    channelId: 'loan-updates',
    sound: 'default',
    ttl: 120,
  };
}

export class ProviderError extends Error {
  constructor(public retryable: boolean) {
    super('PushProviderError');
  }
}

const permanentErrors = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'MismatchSenderId',
  'InvalidCredentials',
]);
export async function runPushWorker(rpc: Rpc, transport: Transport) {
  const deadline = Date.now() + 45000;
  const counts = { accepted: 0, delivered: 0, deferred: 0, failed: 0, cancelled: 0 };
  await rpc('enqueue_due_push', {});
  // One bounded batch per invocation. Claims have leases and SKIP LOCKED.
  for (const receipts of [true, false]) {
    const jobs = (await rpc('claim_push_work', {
      receipts_input: receipts,
      limit_input: 20,
    })) as PushJob[];
    for (const job of jobs) {
      // Unprocessed claims recover after their lease; do not exceed Edge runtime limits.
      if (Date.now() >= deadline) return counts;
      let outcome: string;
      let ticket: string | null = null;
      let error: string | null = null;
      if (
        !receipts &&
        !(await rpc('authorize_push_send', { id_input: job.id, lease_input: job.lease_id }))
      ) {
        counts.cancelled++;
        continue;
      }
      try {
        const response = (await transport(
          receipts ? 'getReceipts' : 'send',
          receipts ? { ids: [job.ticket_id] } : pushMessage(job),
        )) as { data?: unknown };
        const result = (
          receipts
            ? (response.data as Record<string, ProviderResult> | undefined)?.[job.ticket_id!]
            : Array.isArray(response.data)
              ? response.data[0]
              : response.data
        ) as ProviderResult | undefined;
        if (receipts && !result) {
          outcome = 'receipt_wait';
        } else if (result?.status === 'ok' && (receipts || typeof result.id === 'string')) {
          outcome = receipts ? 'delivered' : 'accepted';
          ticket = receipts ? null : result!.id!;
        } else if (result?.status === 'error') {
          // Persist only known machine codes, never provider messages or tokens.
          const code = result.details?.error;
          error =
            code && (permanentErrors.has(code) || code === 'MessageRateExceeded')
              ? code
              : 'ProviderRejected';
          outcome = permanentErrors.has(error)
            ? 'failed'
            : error === 'MessageRateExceeded'
              ? 'retry'
              : receipts
                ? 'failed'
                : 'retry';
        } else {
          error = 'MalformedResponse';
          outcome = receipts ? 'receipt_wait' : 'retry';
        }
      } catch (failure) {
        error = 'ProviderUnavailable';
        outcome =
          failure instanceof ProviderError && !failure.retryable
            ? 'failed'
            : receipts
              ? 'receipt_wait'
              : 'retry';
      }
      // Do not catch database failures as provider failures: the lease recovers them.
      await rpc('finish_push_work', {
        id_input: job.id,
        lease_input: job.lease_id,
        outcome_input: outcome,
        ticket_input: ticket,
        error_input: error,
      });
      if (outcome === 'accepted') counts.accepted++;
      else if (outcome === 'delivered') counts.delivered++;
      else if (outcome === 'failed') counts.failed++;
      else counts.deferred++;
    }
  }
  return counts;
}
