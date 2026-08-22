const inviteTokenPattern = /^[a-f0-9]{64}$/i;

export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && inviteTokenPattern.test(value);
}

export function makeIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
