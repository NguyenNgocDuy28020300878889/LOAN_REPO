import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync('.local/cloud-public.json', 'utf8'));
for (const [environment, port] of [
  ['development', 8082],
  ['staging', 8083],
]) {
  const cloud = config[environment];
  const settings = await fetch(`${cloud.url}/auth/v1/settings`, {
    headers: { apikey: cloud.publishableKey },
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(settings.ok);
  assert.equal((await settings.json()).external.google, true);
  const authorize = new URL(`${cloud.url}/auth/v1/authorize`);
  authorize.search = new URLSearchParams({
    provider: 'google',
    redirect_to: `http://127.0.0.1:${port}/auth/callback`,
    code_challenge: createHash('sha256').update(randomBytes(32)).digest('base64url'),
    code_challenge_method: 's256',
  }).toString();
  const response = await fetch(authorize, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 302, `${environment}: authorize must redirect`);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('redirect_uri'), `${cloud.url}/auth/v1/callback`);
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.ok(location.searchParams.get('state'));
  assert.ok(location.searchParams.get('client_id')?.endsWith('.apps.googleusercontent.com'));
  console.log(
    `PASS ${environment}: provider enabled, PKCE authorize redirects to Google with correct Supabase callback`,
  );
}
console.log(
  'No Google account signed in; full callback/session verification still requires interactive login.',
);
