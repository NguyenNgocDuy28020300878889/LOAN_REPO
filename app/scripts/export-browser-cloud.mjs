import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { browserSourceDigest } from './browser-source-digest.mjs';

const require = createRequire(import.meta.url);
const { assertBuildEnvironment } = require('./build-environment.cjs');
const targets = { development: 'rwfmqthrpbkizcofullh', staging: 'kircmwdkcdcozckrwfid' };
const target = process.argv[2];
assert.ok(Object.hasOwn(targets, target), 'Choose development or staging explicitly');
const cloud = JSON.parse(readFileSync('.local/cloud-public.json', 'utf8'))[target];
assert.equal(cloud.url, `https://${targets[target]}.supabase.co`);
assert.equal(cloud.migrationsReady, true, 'Cloud migrations must be verified before export');
assert.match(cloud.publishableKey, /^sb_publishable_[A-Za-z0-9_-]+$/);
const health = await fetch(`${cloud.url}/auth/v1/health`, {
  headers: { apikey: cloud.publishableKey },
  signal: AbortSignal.timeout(15000),
});
assert.ok(health.ok, 'Hosted Auth is unavailable');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')),
);
Object.assign(env, {
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_EMAIL_OTP_READY: cloud.emailOtpReady ? 'true' : 'false',
  EXPO_PUBLIC_GOOGLE_AUTH_READY: cloud.googleAuthReady ? 'true' : 'false',
  EXPO_PUBLIC_APP_ENV: target,
  [`EXPO_PUBLIC_SUPABASE_${target.toUpperCase()}_URL`]: cloud.url,
  [`EXPO_PUBLIC_SUPABASE_${target.toUpperCase()}_PUBLISHABLE_KEY`]: cloud.publishableKey,
  EXPO_EXPECTED_SUPABASE_PROJECT_REF: targets[target],
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
});
assertBuildEnvironment(env, target === 'staging' ? 'preview' : 'development');
const output = `.local/browser-${target}`;
const sourceDigest = browserSourceDigest();
const result = spawnSync(
  process.execPath,
  ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--clear', '--output-dir', output],
  { env, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
assert.equal(result.status, 0, 'Cloud browser export failed');
assert.equal(browserSourceDigest(), sourceDigest, 'Source changed during export');
writeFileSync(
  `${output}/acceptance-build.json`,
  JSON.stringify({ sourceDigest, apiOrigin: cloud.url, environment: target }),
);
console.log(`${target} browser build complete (SMTP delivery is verified separately)`);
