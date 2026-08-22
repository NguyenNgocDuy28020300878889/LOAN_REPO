import { describe, expect, it } from 'vitest';

import { isInviteToken, makeIdempotencyKey } from './invite';

describe('invite utilities', () => {
  it('accepts only a full hexadecimal server invite token', () => {
    expect(isInviteToken('a'.repeat(64))).toBe(true);
    expect(isInviteToken('a'.repeat(63))).toBe(false);
    expect(isInviteToken('not-a-token')).toBe(false);
  });

  it('creates a UUID v4 shaped idempotency key', () => {
    expect(makeIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
