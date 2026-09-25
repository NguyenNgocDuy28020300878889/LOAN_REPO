// Local Supabase only. Uses random synthetic users and removes retained audit fixtures in finally.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const bytes = readFileSync(new URL('../.local/local-status.json', import.meta.url));
const config = JSON.parse(
  bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''),
);
for (const raw of [config.API_URL, config.FUNCTIONS_URL]) {
  const url = new URL(raw);
  assert.ok(
    url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname),
    'local endpoints only',
  );
}

function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_loan-local',
        'psql',
        '-X',
        '-qAt',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { windowsHide: true },
    );
    let output = '';
    let error = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      error += data;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code) reject(new Error(error));
      else resolve(output.trim());
    });
    child.stdin.end(`set statement_timeout='10s';\n${statement}`);
  });
}

const key = config.PUBLISHABLE_KEY || config.ANON_KEY;
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = [];
const loans = [];
const auditUsers = [];

async function newUser(label) {
  const email = `deletion-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}-Test!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null);
  const user = created.data.user;
  users.push(user.id);
  const client = createClient(config.API_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signedIn.error, null);
  return { user, client };
}

try {
  const owner = await newUser('owner');
  const partner = await newUser('partner');
  const loanId = randomUUID();
  loans.push(loanId);
  await sql(
    `insert into public.loans (
       id, principal_minor, currency, loan_date, due_date, purpose, status, created_by, closed_at
     ) values (
       '${loanId}',1000,'VND','2026-09-01','2026-09-02','Synthetic closed agreement',
       'CLOSED','${owner.user.id}',now()
     );
     insert into public.loan_members (loan_id,user_id,role,membership_status,joined_at) values
       ('${loanId}','${owner.user.id}','LENDER','ACCEPTED',now()),
       ('${loanId}','${partner.user.id}','BORROWER','ACCEPTED',now());`,
  );

  assert.equal((await owner.client.rpc('request_account_deletion')).error, null);
  auditUsers.push(owner.user.id);
  const deleted = await owner.client.functions.invoke('delete-account', { body: {} });
  assert.equal(deleted.error, null);
  assert.deepEqual(deleted.data, { success: true });
  const lookup = await admin.auth.admin.getUserById(owner.user.id);
  assert.equal(lookup.data.user, null);
  assert.ok(lookup.error, 'deleted Auth user is no longer available');
  const history = JSON.parse(
    await sql(
      `select jsonb_build_object(
         'created_by',(select created_by from public.loans where id='${loanId}'),
         'purpose',(select purpose from public.loans where id='${loanId}'),
         'anonymous_members',(select count(*) from public.loan_members where loan_id='${loanId}' and user_id is null),
         'partner_members',(select count(*) from public.loan_members where loan_id='${loanId}' and user_id='${partner.user.id}')
       )`,
    ),
  );
  assert.equal(history.created_by, null);
  assert.equal(history.purpose, null);
  assert.equal(history.anonymous_members, 1);
  assert.equal(history.partner_members, 1);
  const partnerLoans = await partner.client.rpc('get_my_loans');
  assert.equal(partnerLoans.error, null);
  assert.equal(
    partnerLoans.data.some((loan) => loan.id === loanId),
    true,
    'remaining participant can still read the anonymised shared history',
  );
  const auditOutcome = await sql(
    `select outcome from private.account_deletion_audit where former_user_id='${owner.user.id}' order by processed_at desc limit 1`,
  );
  assert.equal(auditOutcome, 'COMPLETED');
  console.log(
    'PASS delete-account function: Auth/profile removed, shared history anonymised, audit completed',
  );

  const recoverable = await newUser('reconcile');
  auditUsers.push(recoverable.user.id);
  assert.equal((await recoverable.client.rpc('request_account_deletion')).error, null);
  const claimed = await admin.rpc('claim_account_deletion', {
    user_id_input: recoverable.user.id,
  });
  assert.equal(claimed.error, null);
  assert.ok(claimed.data.audit_id);
  await sql(
    `update public.account_deletion_requests set processing_started_at=now()-interval '6 minutes' where user_id='${recoverable.user.id}'`,
  );
  const reconciled = await fetch(`${config.FUNCTIONS_URL}/reconcile-account-deletions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-reconcile-secret': 'local-account-deletion-reconcile-test',
    },
    body: '{}',
  });
  assert.equal(reconciled.status, 200);
  const reconciliation = await reconciled.json();
  assert.ok(reconciliation.completed >= 1);
  const recoveredLookup = await admin.auth.admin.getUserById(recoverable.user.id);
  assert.equal(recoveredLookup.data.user, null);
  const recoveredAudit = await sql(
    `select outcome from private.account_deletion_audit where id='${claimed.data.audit_id}'`,
  );
  assert.equal(recoveredAudit, 'COMPLETED');
  console.log('PASS reconciliation: stale processing user deleted and audit completed');
} finally {
  if (loans.length) {
    const ids = loans.map((id) => `'${id}'`).join(',');
    await sql(
      `delete from public.loan_events where loan_id in (${ids});
       delete from public.repayments where loan_id in (${ids});
       delete from public.loan_invites where loan_id in (${ids});
       delete from public.loan_members where loan_id in (${ids});
       delete from public.loans where id in (${ids});`,
    );
  }
  for (const userId of users) {
    const current = await admin.auth.admin.getUserById(userId);
    if (current.data.user) await admin.auth.admin.deleteUser(userId);
  }
  if (auditUsers.length) {
    await sql(
      `delete from private.account_deletion_audit where former_user_id in (${auditUsers
        .map((id) => `'${id}'`)
        .join(',')})`,
    );
  }
}
