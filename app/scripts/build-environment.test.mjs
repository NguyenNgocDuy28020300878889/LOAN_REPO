import { describe, expect, it } from 'vitest';
import guards from './build-environment.cjs';
import configure from '../app.config.js';
import eas from '../eas.json';
import { vi } from 'vitest';

const ref = 'abcdefghijklmnopqrst';
const valid = {
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_SUPABASE_PRODUCTION_URL: `https://${ref}.supabase.co`,
  EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
  EXPO_EXPECTED_SUPABASE_PROJECT_REF: ref,
  EXPO_PUBLIC_APP_LINK_ORIGIN: 'https://loan.example.com',
};
const legacy = (payload) =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

describe('build environment release gate', () => {
  it('accepts explicit production config without returning credentials', () => {
    expect(guards.validateBuildEnvironment(valid, 'production')).toEqual([]);
    const customSchemeOnly = {
      ...valid,
      EXPO_PUBLIC_APP_LINK_ORIGIN: undefined,
      ALLOW_CUSTOM_SCHEME_ONLY_DEEP_LINKING: 'true',
    };
    expect(guards.validateBuildEnvironment(customSchemeOnly, 'production')).toEqual([]);
  });
  it('rejects missing profile, environment or credentials instead of falling back to DEV', () => {
    for (const values of [
      {},
      { ...valid, EXPO_PUBLIC_APP_ENV: undefined },
      { EXPO_PUBLIC_APP_ENV: 'production' },
    ]) {
      expect(guards.validateBuildEnvironment(values, 'production').length).toBeGreaterThan(0);
    }
    expect(guards.validateBuildEnvironment(valid).length).toBeGreaterThan(0);
    expect(guards.validateBuildEnvironment(valid, 'unknown').length).toBeGreaterThan(0);
  });
  it('rejects shared backends, wrong project, unsafe URL and server credentials', () => {
    for (const change of [
      { EXPO_PUBLIC_SUPABASE_DEVELOPMENT_URL: valid.EXPO_PUBLIC_SUPABASE_PRODUCTION_URL },
      { EXPO_EXPECTED_SUPABASE_PROJECT_REF: 'zyxwvutsrqponmlkjihg' },
      { EXPO_PUBLIC_SUPABASE_PRODUCTION_URL: `http://${ref}.supabase.co` },
      { EXPO_PUBLIC_SUPABASE_PRODUCTION_URL: `https://${ref}.supabase.co/?token=secret` },
      { EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY: 'sb_secret_never_print_me' },
      { EXPO_PUBLIC_APP_LINK_ORIGIN: 'http://loan.example.com' },
      { EXPO_PUBLIC_APP_LINK_ORIGIN: 'https://loan.example.com/path' },
      { EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY: legacy({ role: 'service_role', ref }) },
      {
        EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY: legacy({
          role: 'anon',
          ref: 'other-project',
        }),
      },
    ]) {
      const errors = guards.validateBuildEnvironment({ ...valid, ...change }, 'production');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join('\n')).not.toContain('never_print_me');
    }
    expect(
      guards.validateBuildEnvironment(
        {
          ...valid,
          EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY: legacy({ role: 'anon', ref }),
        },
        'production',
      ),
    ).toEqual([]);
  });
  it('maps EAS preview to staging and allows local HTTP only for development', () => {
    const local = {
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_SUPABASE_DEVELOPMENT_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY: legacy({ role: 'anon' }),
    };
    expect(guards.validateBuildEnvironment(local, 'development')).toEqual([]);
    expect(guards.validateBuildEnvironment(local, 'preview').length).toBeGreaterThan(0);
    expect(
      guards.validateBuildEnvironment(
        {
          EXPO_PUBLIC_APP_ENV: 'staging',
          EXPO_EXPECTED_SUPABASE_PROJECT_REF: ref,
          EXPO_PUBLIC_SUPABASE_STAGING_URL: valid.EXPO_PUBLIC_SUPABASE_PRODUCTION_URL,
          EXPO_PUBLIC_SUPABASE_STAGING_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
        },
        'preview',
      ),
    ).toEqual([]);
    expect(eas.build.preview.environment).toBe('preview');
    expect(eas.build.preview.env.EXPO_PUBLIC_APP_ENV).toBe('staging');
    expect(eas.build.preview.env.SENTRY_DISABLE_AUTO_UPLOAD).toBe('true');
    expect(eas.build.production.env.SENTRY_DISABLE_AUTO_UPLOAD).toBeUndefined();
  });
  it('keeps hosted email OTP off until SMTP has been explicitly verified', () => {
    expect(
      guards.validateBuildEnvironment(
        { ...valid, EXPO_PUBLIC_EMAIL_OTP_READY: 'true' },
        'production',
      ),
    ).toContain('EMAIL_OTP_SMTP_VERIFIED=true is required before hosted email OTP is enabled.');
    expect(
      guards.validateBuildEnvironment(
        {
          ...valid,
          EXPO_PUBLIC_EMAIL_OTP_READY: 'true',
          EMAIL_OTP_SMTP_VERIFIED: 'true',
        },
        'production',
      ),
    ).toEqual([]);
  });
  it('gives each environment separate native identifiers while retaining production identity', () => {
    try {
      vi.stubEnv('EAS_BUILD_PROFILE', '');
      vi.stubEnv('EAS_BUILD', '');
      const variants = ['development', 'staging', 'production'].map((value) => {
        vi.stubEnv('EXPO_PUBLIC_APP_ENV', value);
        return configure({ config: { extra: { eas: { projectId: 'same-project' } } } });
      });
      expect(new Set(variants.map((v) => v.android.package)).size).toBe(3);
      expect(new Set(variants.map((v) => v.scheme)).size).toBe(3);
      expect(variants[2].android.package).toBe('com.loanappmobiles.loanapp');
      expect(variants[2].scheme).toBe('loan');
      expect(variants[1].extra.eas.projectId).toBe('same-project');
      for (const variant of variants) {
        expect(variant.android.allowBackup).toBe(false);
        expect(variant.android.blockedPermissions).toEqual(
          expect.arrayContaining([
            'android.permission.SYSTEM_ALERT_WINDOW',
            'android.permission.READ_EXTERNAL_STORAGE',
            'android.permission.WRITE_EXTERNAL_STORAGE',
            'android.permission.USE_BIOMETRIC',
            'android.permission.USE_FINGERPRINT',
          ]),
        );
      }
      vi.stubEnv('EXPO_PUBLIC_APP_ENV', 'production');
      vi.stubEnv('EXPO_PUBLIC_APP_LINK_ORIGIN', 'https://loan.example.com');
      const linked = configure({ config: {} });
      expect(linked.android.intentFilters).toEqual([
        expect.objectContaining({
          autoVerify: true,
          data: [{ scheme: 'https', host: 'loan.example.com', pathPrefix: '/invite/' }],
        }),
      ]);
      vi.stubEnv('EAS_BUILD_PROFILE', 'production');
      vi.stubEnv('EXPO_PUBLIC_APP_ENV', 'development');
      expect(() => configure({ config: {} })).toThrow('Build environment rejected');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
