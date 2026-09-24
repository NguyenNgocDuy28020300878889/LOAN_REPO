import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInviteLink } from './invite-link';

const mocks = vi.hoisted(() => ({
  env: { appLinkOrigin: '' },
  createURL: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('expo-linking', () => ({ createURL: mocks.createURL }));

describe('invitation link generation', () => {
  const token = 'd'.repeat(64);
  beforeEach(() => {
    mocks.env.appLinkOrigin = '';
    mocks.createURL.mockReset();
    mocks.createURL.mockReturnValue(`loan-staging:///invite/${token}`);
  });
  it('keeps the installed-app scheme until a verified HTTPS origin is configured', () => {
    expect(createInviteLink(token)).toBe(`loan-staging:///invite/${token}`);
    expect(mocks.createURL).toHaveBeenCalledWith(`/invite/${token}`);
  });
  it('shares an HTTPS App Link when its origin is configured', () => {
    mocks.env.appLinkOrigin = 'https://loan.example.com';
    expect(createInviteLink(token)).toBe(`https://loan.example.com/invite/${token}`);
    expect(mocks.createURL).not.toHaveBeenCalled();
  });
  it('never generates a link for a malformed token', () => {
    expect(() => createInviteLink('short')).toThrow('INVALID_INVITE_TOKEN');
  });
});
