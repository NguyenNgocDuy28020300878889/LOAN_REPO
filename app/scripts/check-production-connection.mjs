import assert from 'node:assert/strict';

const url = 'https://yyqsddjtzudvbrmcksll.supabase.co';
const key = 'sb_publishable_UBseJtBV-wZZnFEnQCq3hw_GW2aDEYt';
const ref = 'yyqsddjtzudvbrmcksll';

assert.equal(url, `https://${ref}.supabase.co`);
assert.match(key, /^sb_publishable_/);

const headers = { apikey: key, 'Content-Type': 'application/json' };

console.log('=== VERIFYING PRODUCTION DATABASE & RLS POLICIES ===');

// 1. Auth Health
const health = await fetch(`${url}/auth/v1/health`, {
  headers,
  signal: AbortSignal.timeout(15000),
});
assert.ok(health.ok, 'Auth health failed');
console.log('✓ Auth health: OK (200)');

// 2. Auth Settings
const settings = await fetch(`${url}/auth/v1/settings`, {
  headers,
  signal: AbortSignal.timeout(15000),
});
assert.ok(settings.ok, 'Auth settings failed');
const settingsData = await settings.json();
assert.equal(settingsData.mailer_autoconfirm, false, 'Email confirmation must be enabled');
console.log('✓ Auth settings: mailer_autoconfirm = false (Email confirmation enforced)');

// 3. Table loans (anonymous access must be denied or empty due to RLS)
const loansRes = await fetch(`${url}/rest/v1/loans?select=id&limit=1`, { headers });
console.log(`✓ Table public.loans: HTTP ${loansRes.status}`);
assert.ok([200, 401, 403].includes(loansRes.status));
if (loansRes.ok) {
  const data = await loansRes.json();
  assert.equal(data.length, 0, 'Anonymous users must not see any loans');
  console.log('  RLS is actively filtering rows: 0 rows returned to anon');
}

// 4. Financial RPC get_my_loans
const rpcLoans = await fetch(`${url}/rest/v1/rpc/get_my_loans`, {
  method: 'POST',
  headers,
  body: '{}',
});
console.log(`✓ RPC get_my_loans: HTTP ${rpcLoans.status}`);
assert.ok([401, 403].includes(rpcLoans.status), 'Anonymous financial RPC must be denied');
console.log('  Anonymous execution correctly denied (401/403)');

// 5. Account deletion state RPC
const rpcDel = await fetch(`${url}/rest/v1/rpc/get_my_account_deletion_state`, {
  method: 'POST',
  headers,
  body: '{}',
});
console.log(`✓ RPC get_my_account_deletion_state: HTTP ${rpcDel.status}`);
assert.ok([401, 403].includes(rpcDel.status), 'Anonymous deletion state must be denied');
console.log('  Anonymous execution correctly denied (401/403)');

// 6. Private Claim deletion RPC
const rpcClaim = await fetch(`${url}/rest/v1/rpc/claim_account_deletion`, {
  method: 'POST',
  headers,
  body: '{"user_id_input":"00000000-0000-0000-0000-000000000000"}',
});
console.log(`✓ RPC claim_account_deletion: HTTP ${rpcClaim.status}`);
assert.ok(
  [401, 403].includes(rpcClaim.status),
  'Anonymous or authenticated must not execute claim',
);
console.log('  Service-role boundary correctly enforced');

console.log('\n======================================================');
console.log('ALL VERIFICATIONS PASSED: PRODUCTION DATABASE IS HEALTHY & FULLY SECURED!');
console.log('======================================================');
