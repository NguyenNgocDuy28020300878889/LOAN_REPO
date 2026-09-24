import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

async function loadEmailOtpReady(environment: string, configured?: string) {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_APP_ENV', environment);
  if (configured === undefined) vi.stubEnv('EXPO_PUBLIC_EMAIL_OTP_READY', undefined);
  else vi.stubEnv('EXPO_PUBLIC_EMAIL_OTP_READY', configured);
  return (await import('./env')).env.emailOtpReady;
}

describe('public environment feature gates', () => {
  it('supports local OTP by default for Mailpit integration tests', async () => {
    expect(await loadEmailOtpReady('development')).toBe(true);
    expect(await loadEmailOtpReady('development', 'false')).toBe(false);
  });
  it('fails closed for hosted OTP unless the build explicitly enables it', async () => {
    expect(await loadEmailOtpReady('staging')).toBe(false);
    expect(await loadEmailOtpReady('production')).toBe(false);
    expect(await loadEmailOtpReady('staging', 'true')).toBe(true);
  });
});
