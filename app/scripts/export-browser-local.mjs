import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { browserSourceDigest } from './browser-source-digest.mjs';

const bytes = readFileSync(new URL('../.local/local-status.json', import.meta.url));
const config = JSON.parse(
  bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''),
);
const apiUrl = new URL(config.API_URL);
assert.ok(
  apiUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(apiUrl.hostname) &&
    Boolean(apiUrl.port),
  'local API endpoint only',
);
assert.match(config.PUBLISHABLE_KEY, /^sb_publishable_/);
// No .env/cloud configuration, secrets, or stale Metro transforms in this build.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_')),
);
Object.assign(env, {
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_SUPABASE_DEVELOPMENT_URL: config.API_URL,
  EXPO_PUBLIC_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY: config.PUBLISHABLE_KEY,
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
});
const sourceDigest = browserSourceDigest();
const result = spawnSync(
  process.execPath,
  [
    'node_modules/expo/bin/cli',
    'export',
    '--platform',
    'web',
    '--clear',
    '--output-dir',
    '.local/browser-dist',
  ],
  { env, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
if (result.status === 0) {
  assert.equal(
    browserSourceDigest(),
    sourceDigest,
    'Source changed during export; rebuild before testing',
  );
  writeFileSync(
    '.local/browser-dist/acceptance-build.json',
    JSON.stringify({ sourceDigest, apiOrigin: config.API_URL }),
  );
}
process.exitCode = result.status ?? 1;
