export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' &&
    (/^\/invite\/[a-f0-9]{64}$/i.test(value) ||
      /^\/pending-invite\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ))
    ? value
    : '/';
}

export function parseAuthCode(callback: string, expectedRedirect: string): string {
  const actual = new URL(callback);
  const expected = new URL(expectedRedirect);
  if (
    actual.protocol !== expected.protocol ||
    actual.hostname !== expected.hostname ||
    actual.port !== expected.port ||
    actual.pathname !== expected.pathname ||
    actual.username ||
    actual.password ||
    actual.hash
  )
    throw new Error('INVALID_AUTH_CALLBACK');
  if (actual.searchParams.has('error') || actual.searchParams.has('error_description'))
    throw new Error('AUTH_CALLBACK_FAILED');
  const codes = actual.searchParams.getAll('code');
  if (codes.length !== 1 || !/^[A-Za-z0-9_-]{8,2048}$/.test(codes[0]))
    throw new Error('INVALID_AUTH_CODE');
  return codes[0];
}
