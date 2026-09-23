import { describe, expect, it } from 'vitest';

import { getInviteUnavailableReason, isInviteToken, parseInviteMessage } from './invite';

describe('invite utilities', () => {
  it('accepts the triple-slash link shared by the Android APK and pasted from Gmail', () => {
    const token = 'b'.repeat(64);
    expect(
      parseInviteMessage(`Invitation\n\nloan-staging:///invite/${token}\u00a0`, 'staging'),
    ).toBe(token);
    expect(parseInviteMessage(`loan-staging:///invite/${token}`, 'development')).toBeNull();
    expect(parseInviteMessage(`loan-staging:////invite/${token}`, 'staging')).toBeNull();
    expect(parseInviteMessage(`loan-staging:///invite/${token}/extra`, 'staging')).toBeNull();
  });
  it('opens a complete message only in the matching environment', () => {
    const token = 'a'.repeat(64);
    const link = `loan-staging://invite/${token}`;
    expect(parseInviteMessage(`Invitation\n\n${link}`, 'staging')).toBe(token);
    expect(parseInviteMessage(link, 'production')).toBeNull();
    expect(parseInviteMessage(`https://example.com/invite/${token}`, 'staging')).toBeNull();
    expect(parseInviteMessage(`${link}\n${link}`, 'staging')).toBeNull();
    expect(parseInviteMessage(`${link}?extra=true`, 'staging')).toBeNull();
    expect(parseInviteMessage(`loan-staging://invite/${'a'.repeat(63)}`, 'staging')).toBeNull();
    expect(parseInviteMessage(`loan://invite/${token}`, 'production')).toBe(token);
  });
  it('accepts only a full hexadecimal server invite token', () => {
    expect(isInviteToken('a'.repeat(64))).toBe(true);
    expect(isInviteToken('a'.repeat(63))).toBe(false);
    expect(isInviteToken('not-a-token')).toBe(false);
  });
  it('turns server invite lifecycle errors into safe user-facing states', () => {
    expect(getInviteUnavailableReason({ message: 'INVITE_EXPIRED' })).toBe('expired');
    expect(getInviteUnavailableReason(new Error('INVITE_REVOKED'))).toBe('revoked');
    expect(getInviteUnavailableReason({ message: 'INVITE_ALREADY_USED' })).toBe('used');
    expect(getInviteUnavailableReason({ message: 'INVITE_UNAVAILABLE' })).toBe('used');
    expect(getInviteUnavailableReason({ message: 'database detail that must stay private' })).toBe(
      'invalid',
    );
  });
});
