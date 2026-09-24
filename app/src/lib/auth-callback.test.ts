import { describe, expect, it } from 'vitest';
import { parseAuthCode, safeReturnPath } from './auth-callback';
describe('auth callback validation', () => {
  const redirect = 'loan-staging://auth/callback';
  it('passes only the auth code to the PKCE exchange', () => {
    expect(parseAuthCode(`${redirect}?code=valid-code-1234`, redirect)).toBe('valid-code-1234');
  });
  it('rejects wrong scheme, host, path, repeated codes, fragments and provider errors', () => {
    for (const url of [
      'loan://auth/callback?code=valid-code-1234',
      'loan-staging://evil/callback?code=valid-code-1234',
      'loan-staging://auth/other?code=valid-code-1234',
      `${redirect}?code=valid-code-1234&code=other-code-1234`,
      `${redirect}#access_token=synthetic`,
      `${redirect}?error=access_denied&code=valid-code-1234`,
      `${redirect}?code=`,
    ]) {
      expect(() => parseAuthCode(url, redirect)).toThrow();
    }
  });
  it('allows only an internal invitation return path', () => {
    expect(safeReturnPath('/account-deletion')).toBe('/account-deletion');
    expect(safeReturnPath(`/invite/${'a'.repeat(64)}`)).toBe(`/invite/${'a'.repeat(64)}`);
    const pending = '/pending-invite/94000000-0000-4000-8000-000000000001';
    expect(safeReturnPath(pending)).toBe(pending);
    for (const path of [
      '//evil.example',
      'https://evil.example',
      '/auth/callback',
      '/invite/not-a-token',
      '/pending-invite/not-a-uuid',
      '/\\evil.example',
      ['/invite/a'],
    ])
      expect(safeReturnPath(path)).toBe('/');
  });
});
