const inviteTokenPattern = /^[a-f0-9]{64}$/i;

export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && inviteTokenPattern.test(value);
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
