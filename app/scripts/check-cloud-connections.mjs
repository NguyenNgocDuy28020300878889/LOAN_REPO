import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const cloud = JSON.parse(readFileSync('.local/cloud-public.json', 'utf8'));
const targets = { development: 'rwfmqthrpbkizcofullh', staging: 'kircmwdkcdcozckrwfid' };
assert.notEqual(cloud.development.url, cloud.staging.url);
for (const [environment, ref] of Object.entries(targets)) {
  const config = cloud[environment];
  assert.equal(config.url, `https://${ref}.supabase.co`);
  assert.match(config.publishableKey, /^sb_publishable_/);
  const headers = { apikey: config.publishableKey, 'Content-Type': 'application/json' };
  const health = await fetch(`${config.url}/auth/v1/health`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(health.ok, `${environment}: Auth health`);
  const settings = await fetch(`${config.url}/auth/v1/settings`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(settings.ok, `${environment}: public configuration and key work`);
  assert.equal((await settings.json()).mailer_autoconfirm, false);
  const rpc = await fetch(`${config.url}/rest/v1/rpc/get_my_loans`, {
    method: 'POST',
    headers,
    body: '{}',
    signal: AbortSignal.timeout(15000),
  });
  assert.ok([401, 403].includes(rpc.status), `${environment}: anonymous financial RPC denied`);
  const table = await fetch(`${config.url}/rest/v1/loans?select=id&limit=1`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  assert.ok([401, 403].includes(table.status), `${environment}: anonymous table access denied`);
  console.log(
    `PASS ${environment}: hosted Auth/API reachable, publishable key valid, confirmation required, anonymous financial access denied`,
  );
}
console.log('No verification emails sent; Gmail delivery still requires SMTP setup.');
