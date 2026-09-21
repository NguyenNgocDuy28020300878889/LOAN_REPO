// Real local GoTrue + Mailpit integration. Never accepts a remote endpoint.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { waitForLocalEmailCode } from './local-email-code.mjs';

const bytes = readFileSync(new URL('../.local/local-status.json', import.meta.url));
const config = JSON.parse(
  bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''),
);
for (const [raw, port] of [
  [config.API_URL, '54321'],
  [config.MAILPIT_URL, '54324'],
]) {
  const url = new URL(raw);
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === port,
    'local test endpoints only',
  );
}
const mail = new URL(config.MAILPIT_URL).origin;
const email = `loan-auth-${randomUUID()}@example.invalid`;
const password = `${randomUUID()}-Test!`;
const values = new Map();
const client = createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  },
});
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const messages = new Set();
let userId;
async function emailCallback() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const inbox = await (await fetch(`${mail}/api/v1/messages`)).json();
    const message = inbox.messages.find(
      (item) => !messages.has(item.ID) && item.To?.some((recipient) => recipient.Address === email),
    );
    if (message) {
      messages.add(message.ID);
      const body = await (await fetch(`${mail}/api/v1/message/${message.ID}`)).json();
      const link = body.HTML.match(/href="([^"]+\/auth\/v1\/verify[^\"]+)"/)?.[1]?.replaceAll(
        '&amp;',
        '&',
      );
      assert.ok(link, 'verification link exists');
      assert.equal(
        new URL(link).origin,
        new URL(config.API_URL).origin,
        'verification endpoint stays local',
      );
      const response = await fetch(link, { redirect: 'manual' });
      const callback = new URL(response.headers.get('location'));
      assert.equal(callback.origin, 'http://localhost:8081');
      assert.equal(callback.pathname, '/auth/callback');
      const code = callback.searchParams.get('code');
      assert.ok(code && !callback.searchParams.has('error'), 'PKCE authorization code returned');
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('LOCAL_CONFIRMATION_EMAIL_TIMEOUT');
}
try {
  const weak = await client.auth.signUp({ email, password: 'short' });
  assert.ok(weak.error, 'server rejects short passwords');
  const signup = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'http://localhost:8081/auth/callback' },
  });
  assert.equal(signup.error, null);
  userId = signup.data.user.id;
  assert.equal(signup.data.session, null, 'signup awaits email verification');
  const blocked = await client.auth.signInWithPassword({ email, password });
  assert.ok(blocked.error, 'unverified email cannot sign in');
  const code = await waitForLocalEmailCode(mail, email, messages);
  const confirmed = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  assert.equal(confirmed.error, null);
  assert.equal(confirmed.data.user.id, userId);
  const session = confirmed.data.session;
  const persisted = [...values.values()].some((value) => value.includes(session.refresh_token));
  assert.ok(persisted, 'SDK persisted the session through the configured adapter');
  const anon = createClient(config.API_URL, config.PUBLISHABLE_KEY || config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok((await anon.rpc('get_my_loans')).error, 'anonymous financial RPC rejected over HTTP');
  assert.equal((await client.rpc('get_my_loans')).error, null, 'confirmed JWT accesses own list');
  assert.ok(
    (await client.auth.verifyOtp({ email, token: code, type: 'email' })).error,
    'email code cannot be replayed',
  );
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  assert.equal((await client.auth.signOut()).error, null);
  console.log(
    'PASS local signup, mandatory email code, one-time verification, persistence, RPC JWT, logout',
  );

  // Avoid the deliberately configured local mail throttle between test messages.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(
    (
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:8081/auth/callback',
      })
    ).error,
    null,
  );
  const resetCode = await emailCallback();
  const reset = await client.auth.exchangeCodeForSession(resetCode);
  assert.equal(reset.error, null);
  assert.equal(reset.data.redirectType, 'recovery', 'SDK marks genuine recovery redirects');
  const replacement = `${randomUUID()}-Changed!`;
  // Same explicit-JWT endpoint as the app recovery flow; never resolve another account's token.
  const changed = await fetch(`${config.API_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: config.PUBLISHABLE_KEY || config.ANON_KEY,
      Authorization: `Bearer ${reset.data.session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password: replacement }),
  });
  assert.ok(changed.ok);
  await client.auth.signOut();
  assert.ok(
    (await client.auth.signInWithPassword({ email, password })).error,
    'old password rejected',
  );
  assert.equal(
    (await client.auth.signInWithPassword({ email, password: replacement })).error,
    null,
  );
  await client.auth.signOut();
  console.log('PASS local recovery PKCE, password replacement, old password rejected, new login');
} finally {
  await client.auth.signOut({ scope: 'local' });
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Synthetic auth fixture cleanup failed: ${error.code}`);
  }
  if (messages.size) {
    const response = await fetch(`${mail}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: [...messages] }),
    });
    assert.ok(response.ok, 'synthetic mail cleanup succeeds');
  }
}
