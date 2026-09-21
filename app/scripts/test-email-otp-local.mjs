import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { waitForLocalEmailCode } from './local-email-code.mjs';

const bytes = readFileSync('.local/local-status.json');
const config = JSON.parse(
  bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''),
);
assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const options = { auth: { persistSession: false, autoRefreshToken: false, flowType: 'pkce' } };
const client = createClient(config.API_URL, config.PUBLISHABLE_KEY, options);
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const email = `otp-${randomUUID()}@example.invalid`;
const seen = new Set();
let userId;
try {
  assert.equal(
    (await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })).error,
    null,
  );
  assert.equal(
    (await client.auth.getSession()).data.session,
    null,
    'requesting code does not sign in',
  );
  assert.ok((await client.rpc('get_my_loans')).error, 'unverified requester cannot read loans');
  const token = await waitForLocalEmailCode(config.MAILPIT_URL, email, seen);
  const wrong = (token[0] === '0' ? '1' : '0') + token.slice(1);
  assert.ok(
    (await client.auth.verifyOtp({ email, token: wrong, type: 'email' })).error,
    'wrong code rejected',
  );
  assert.ok(
    (
      await client.auth.verifyOtp({
        email: `other-${randomUUID()}@example.invalid`,
        token,
        type: 'email',
      })
    ).error,
    'code is bound to recipient',
  );
  const verified = await client.auth.verifyOtp({ email, token, type: 'email' });
  assert.equal(verified.error, null);
  assert.ok(verified.data.session);
  userId = verified.data.user.id;
  assert.equal((await client.rpc('get_my_loans')).error, null);
  await client.auth.signOut();
  assert.ok(
    (await client.auth.verifyOtp({ email, token, type: 'email' })).error,
    'used code cannot be replayed',
  );
  assert.equal((await client.auth.getSession()).data.session, null);
  // Local mail throttle is 1s for integration tests; hosted must use at least 60s.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(
    (await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })).error,
    null,
  );
  const second = await waitForLocalEmailCode(config.MAILPIT_URL, email, seen);
  const login = await client.auth.verifyOtp({ email, token: second, type: 'email' });
  assert.equal(login.error, null);
  assert.equal(login.data.user.id, userId, 'repeat sign-in reuses account');
  console.log(
    'PASS passwordless registration, no session before verification, wrong code/recipient denial, one-time use, existing-account sign-in',
  );
} finally {
  await client.auth.signOut({ scope: 'local' });
  if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
  if (seen.size) {
    const response = await fetch(`${new URL(config.MAILPIT_URL).origin}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: [...seen] }),
    });
    assert.ok(response.ok);
  }
}
