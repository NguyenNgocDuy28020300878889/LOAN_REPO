const inviteTokenPattern = /^[a-f0-9]{64}$/i;

export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && inviteTokenPattern.test(value);
}

export type InviteUnavailableReason = 'expired' | 'revoked' | 'used' | 'invalid';

export function getInviteUnavailableReason(error: unknown): InviteUnavailableReason {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);
  if (message.includes('INVITE_EXPIRED')) return 'expired';
  if (message.includes('INVITE_REVOKED')) return 'revoked';
  if (message.includes('INVITE_ALREADY_USED') || message.includes('INVITE_UNAVAILABLE')) {
    return 'used';
  }
  return 'invalid';
}

export function parseInviteMessage(value: string, environment: string): string | null {
  const scheme = environment === 'production' ? 'loan' : `loan-${environment}`;
  const links = value
    .trim()
    .split(/\s+/)
    .filter((part) => part.includes('://'));
  if (links.length !== 1) return null;
  const match = new RegExp(`^${scheme}:///?invite/([a-f0-9]{64})$`, 'i').exec(links[0]);
  return match?.[1] ?? null;
}
