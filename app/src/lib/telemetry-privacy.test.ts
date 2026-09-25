import { describe, expect, it } from 'vitest';
import { privateErrorEvent } from './telemetry-privacy';

describe('telemetry data minimization', () => {
  it('drops arbitrary error text, request data, tokens, user details and breadcrumbs', () => {
    const sensitive = 'private@example.invalid/invite/secret-token?amount=123456';
    const result = privateErrorEvent({
      type: undefined,
      event_id: 'a'.repeat(32),
      message: sensitive,
      transaction: sensitive,
      user: { email: sensitive },
      request: { url: sensitive, headers: { Authorization: sensitive } },
      extra: { note: sensitive },
      contexts: { loan: { amount: sensitive } },
      breadcrumbs: [{ message: sensitive }],
      tags: { url: sensitive },
      exception: {
        values: [
          {
            type: sensitive,
            value: sensitive,
            stacktrace: {
              frames: [
                {
                  filename: sensitive,
                  function: sensitive,
                  vars: { token: sensitive },
                  lineno: 12,
                  colno: 5,
                },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain(sensitive);
    expect(result.exception?.values?.[0].value).toBe('Unexpected application error');
    expect(result.exception?.values?.[0].stacktrace?.frames?.[0].lineno).toBe(12);
    expect(result.user).toBeUndefined();
    expect(result.request).toBeUndefined();
  });
  it('retains reviewed error codes and bundle positions for diagnosis', () => {
    const result = privateErrorEvent({
      type: undefined,
      exception: {
        values: [
          {
            value: 'SESSION_CHANGED',
            stacktrace: {
              frames: [{ filename: 'app:///index.android.bundle', lineno: 1, colno: 2400 }],
            },
          },
        ],
      },
    });
    expect(result.exception?.values?.[0].value).toBe('SESSION_CHANGED');
    expect(result.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBe(
      'app:///index.android.bundle',
    );
  });
  it('retains account deletion safety error codes', () => {
    const result = privateErrorEvent({
      type: undefined,
      exception: {
        values: [{ value: 'ACCOUNT_DELETION_BLOCKED' }],
      },
    });
    expect(result.exception?.values?.[0].value).toBe('ACCOUNT_DELETION_BLOCKED');
  });
});
