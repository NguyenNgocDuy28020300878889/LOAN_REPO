const environments = {
  development: 'development',
  preview: 'staging',
  production: 'production',
};

function validPublicOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname === '/' &&
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

// Only report variable names and invariant failures, never credential values.
function validateBuildEnvironment(values, profile = values.EAS_BUILD_PROFILE) {
  const errors = [];
  if (!Object.hasOwn(environments, profile ?? '')) {
    return ['A known EAS_BUILD_PROFILE (development, preview, production) is required.'];
  }
  const appEnv = environments[profile];
  if (values.EXPO_PUBLIC_APP_ENV !== appEnv) {
    errors.push(`EXPO_PUBLIC_APP_ENV must be ${appEnv} for the ${profile} profile.`);
  }
  const prefix = `EXPO_PUBLIC_SUPABASE_${appEnv.toUpperCase()}`;
  const rawUrl = values[`${prefix}_URL`] ?? '';
  const key = values[`${prefix}_PUBLISHABLE_KEY`] ?? '';
  let url;
  try {
    url = new URL(rawUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' &&
        !(appEnv === 'development' && local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      errors.push(
        `${prefix}_URL must be a clean HTTPS origin (local HTTP allowed only in development).`,
      );
    }
  } catch {
    errors.push(`${prefix}_URL is missing or invalid.`);
  }
  if (!key) {
    errors.push(`${prefix}_PUBLISHABLE_KEY is required.`);
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    // Legacy anon JWTs are public config. This inspects their role/ref, not their signature.
    try {
      if (key.split('.').length !== 3) throw new Error();
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon') throw new Error();
      if (payload.ref && url && url.hostname !== `${payload.ref}.supabase.co`) {
        errors.push(`${prefix}_PUBLISHABLE_KEY project reference does not match the URL.`);
      }
    } catch {
      errors.push(
        `${prefix}_PUBLISHABLE_KEY must be a publishable key or legacy anon JWT, never a server secret.`,
      );
    }
  }
  if (appEnv !== 'development') {
    const expectedRef = values.EXPO_EXPECTED_SUPABASE_PROJECT_REF ?? '';
    if (!/^[a-z0-9]{20}$/.test(expectedRef)) {
      errors.push('EXPO_EXPECTED_SUPABASE_PROJECT_REF must identify the intended hosted project.');
    } else if (!url || url.origin !== `https://${expectedRef}.supabase.co`) {
      errors.push(`${prefix}_URL does not match EXPO_EXPECTED_SUPABASE_PROJECT_REF.`);
    }
    for (const other of Object.values(environments).filter((item) => item !== appEnv)) {
      const otherUrl = values[`EXPO_PUBLIC_SUPABASE_${other.toUpperCase()}_URL`];
      if (otherUrl && url) {
        try {
          if (new URL(otherUrl).origin === url.origin) {
            errors.push(`${appEnv} and ${other} must not share a backend.`);
          }
        } catch {
          /* Validation of the selected environment is sufficient. */
        }
      }
    }
  }
  const appLinkOrigin = values.EXPO_PUBLIC_APP_LINK_ORIGIN ?? '';
  if (appLinkOrigin && !validPublicOrigin(appLinkOrigin)) {
    errors.push('EXPO_PUBLIC_APP_LINK_ORIGIN must be a clean public HTTPS origin.');
  } else if (appEnv === 'production' && !appLinkOrigin) {
    errors.push('EXPO_PUBLIC_APP_LINK_ORIGIN is required for production App Links.');
  }
  if (
    appEnv !== 'development' &&
    values.EXPO_PUBLIC_EMAIL_OTP_READY === 'true' &&
    values.EMAIL_OTP_SMTP_VERIFIED !== 'true'
  ) {
    errors.push('EMAIL_OTP_SMTP_VERIFIED=true is required before hosted email OTP is enabled.');
  }
  return errors;
}

function assertBuildEnvironment(values, profile) {
  const errors = validateBuildEnvironment(values, profile);
  if (errors.length) throw new Error(`Build environment rejected:\n- ${errors.join('\n- ')}`);
}

module.exports = {
  environments,
  validPublicOrigin,
  validateBuildEnvironment,
  assertBuildEnvironment,
};

if (require.main === module) {
  // Expo's loader respects shell/EAS values and loads an untracked .env locally.
  require('@expo/env').load(require('node:path').resolve(__dirname, '..'), { silent: true });
  try {
    assertBuildEnvironment(process.env, process.argv[2] || process.env.EAS_BUILD_PROFILE);
    console.log('Build environment preflight passed (values redacted).');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
