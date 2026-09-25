// Local Docker only: committed synthetic fixtures are removed in finally.
// No connection string or remote database target is accepted.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

function sql(statement, allowFailure = false) {
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
      if (code && !allowFailure) reject(new Error(error));
      else resolve({ code, output: output.trim(), error });
    });
    child.stdin.end(`set statement_timeout='10s';\n${statement}`);
  });
}
const a = randomUUID();
const b = randomUUID();
const deleting = randomUUID();
const deletingSession = randomUUID();
const loans = [];
const asUser = (user, statement) =>
  `begin; set local role authenticated; set local request.jwt.claim.sub='${user}'; ${statement}; commit;`;
async function pendingFixture() {
  const result = await sql(
    asUser(
      a,
      `select public.create_loan('LENDER',1000,'VND','2026-09-01','2026-10-01',null,null,'${randomUUID()}')`,
    ),
  );
  const loan = JSON.parse(result.output);
  loans.push(loan.loan_id);
  return loan;
}
async function fixture(two = false) {
  const loan = await pendingFixture();
  await sql(
    asUser(b, `select public.accept_loan_invite('${loan.invite_token}','${randomUUID()}')`),
  );
  const repayments = [];
  for (let i = 0; i < (two ? 2 : 1); i++) {
    const submitted = await sql(
      asUser(
        a,
        `select public.submit_repayment('${loan.loan_id}',1000,'2026-09-02',null,null,'${randomUUID()}')`,
      ),
    );
    repayments.push(JSON.parse(submitted.output).repayment_id);
  }
  return { id: loan.loan_id, repayments };
}
// Hold the loan in a third connection until both workers are waiting on locks.
async function race(loan, commands) {
  const gate = spawn(
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
  let signal = '';
  let stderr = '';
  const ready = new Promise((resolve, reject) => {
    gate.stdout.on('data', (data) => {
      signal += data;
      if (signal.includes('LOCKED')) resolve();
    });
    gate.on('error', reject);
    gate.stderr.on('data', (data) => {
      stderr += data;
    });
    gate.on('close', (code) => {
      if (!signal.includes('LOCKED')) reject(new Error(stderr || `gate closed ${code}`));
    });
  });
  const closed = new Promise((resolve) => gate.on('close', resolve));
  gate.stdin.write(
    `begin; set local idle_in_transaction_session_timeout='15s'; select id from public.loans where id='${loan}' for update; select 'LOCKED';\n`,
  );
  const running = [];
  try {
    await ready;
    const tag = `loan_race_${randomUUID().replaceAll('-', '')}`;
    for (const command of commands)
      running.push(sql(`set application_name='${tag}'; ${command}`, true));
    const deadline = Date.now() + 8000;
    let blocked = 0;
    while (Date.now() < deadline) {
      blocked = Number(
        (
          await sql(
            `select count(*) from pg_stat_activity where application_name='${tag}' and wait_event_type='Lock'`,
          )
        ).output,
      );
      if (blocked === commands.length) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(blocked, commands.length, 'both independent connections must contend for locks');
    gate.stdin.end('commit;\n');
    return await Promise.all(running);
  } finally {
    if (!gate.stdin.writableEnded) gate.stdin.end('rollback;\n');
    await closed;
    await Promise.allSettled(running);
  }
}
async function accountRace(user, commands) {
  const gate = spawn(
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
  let signal = '';
  let stderr = '';
  const ready = new Promise((resolve, reject) => {
    gate.stdout.on('data', (data) => {
      signal += data;
      if (signal.includes('LOCKED')) resolve();
    });
    gate.stderr.on('data', (data) => {
      stderr += data;
    });
    gate.on('error', reject);
    gate.on('close', (code) => {
      if (!signal.includes('LOCKED')) reject(new Error(stderr || `gate closed ${code}`));
    });
  });
  const closed = new Promise((resolve) => gate.on('close', resolve));
  gate.stdin.write(
    `begin; set local idle_in_transaction_session_timeout='15s'; select private.lock_accounts(array['${user}'::uuid]); select 'LOCKED';\n`,
  );
  const running = [];
  try {
    await ready;
    const tag = `account_deletion_race_${randomUUID().replaceAll('-', '')}`;
    for (const command of commands)
      running.push(sql(`set application_name='${tag}'; ${command}`, true));
    const deadline = Date.now() + 8000;
    let blocked = 0;
    while (Date.now() < deadline) {
      blocked = Number(
        (
          await sql(
            `select count(*) from pg_stat_activity where application_name='${tag}' and wait_event_type='Lock'`,
          )
        ).output,
      );
      if (blocked === commands.length) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(blocked, commands.length, 'account commands must contend for the deletion lock');
    gate.stdin.end('commit;\n');
    return await Promise.all(running);
  } finally {
    if (!gate.stdin.writableEnded) gate.stdin.end('rollback;\n');
    await closed;
    await Promise.allSettled(running);
  }
}
async function state(id) {
  return JSON.parse(
    (
      await sql(`select jsonb_build_object(
    'status',l.status,'balance',l.principal_minor-coalesce((select sum(amount_minor) from public.repayments where loan_id=l.id and status='CONFIRMED'),0),
    'confirmed',(select count(*) from public.repayments where loan_id=l.id and status='CONFIRMED'),
    'pending',(select count(*) from public.repayments where loan_id=l.id and status='PENDING'),
    'events',(select count(*) from public.loan_events where loan_id=l.id and event_type='REPAYMENT_CONFIRMED')
  ) from public.loans l where l.id='${id}'`)
    ).output,
  );
}
try {
  await sql(
    `insert into auth.users(id,email) values ('${a}','${a}@example.invalid'),('${b}','${b}@example.invalid')`,
  );
  const first = await fixture(true);
  const confirmations = await race(
    first.id,
    first.repayments.map((id) =>
      asUser(b, `select public.confirm_repayment('${id}','${randomUUID()}')`),
    ),
  );
  assert.equal(confirmations.filter((r) => r.code === 0).length, 1);
  assert.match(confirmations.find((r) => r.code !== 0).error, /REPAYMENT_NOT_PENDING/);
  assert.deepEqual(await state(first.id), {
    status: 'REPAID',
    balance: 0,
    confirmed: 1,
    pending: 0,
    events: 1,
  });
  console.log('PASS simultaneous full repayments: one settlement, other proposal cancelled');

  const second = await fixture();
  const key = randomUUID();
  const command = asUser(b, `select public.confirm_repayment('${second.repayments[0]}','${key}')`);
  const retries = await race(second.id, [command, command]);
  assert.ok(retries.every((r) => r.code === 0));
  assert.equal(retries[0].output, retries[1].output);
  assert.deepEqual(await state(second.id), {
    status: 'REPAID',
    balance: 0,
    confirmed: 1,
    pending: 0,
    events: 1,
  });
  console.log('PASS concurrent identical retries: same receipt, one balance change');

  const third = await fixture();
  const repayment = third.repayments[0];
  const decisions = await race(third.id, [
    asUser(b, `select public.confirm_repayment('${repayment}','${randomUUID()}')`),
    asUser(a, `select public.cancel_repayment('${repayment}','${randomUUID()}')`),
  ]);
  assert.equal(decisions.filter((r) => r.code === 0).length, 1);
  assert.match(decisions.find((r) => r.code !== 0).error, /REPAYMENT_NOT_PENDING/);
  const final = await state(third.id);
  assert.equal(final.pending, 0);
  assert.equal(final.balance, final.confirmed ? 0 : 1000);
  assert.equal(final.events, final.confirmed);
  assert.equal(final.status, final.confirmed ? 'REPAID' : 'ACTIVE');
  console.log('PASS confirm versus cancel: one final decision, no deadlock');
  const fourth = await pendingFixture();
  const invitations = await race(fourth.loan_id, [
    asUser(b, `select public.accept_loan_invite('${fourth.invite_token}','${randomUUID()}')`),
    asUser(a, `select public.manage_loan_invite('${fourth.loan_id}','revoke','${randomUUID()}')`),
  ]);
  assert.equal(invitations.filter((r) => r.code === 0).length, 1);
  assert.match(invitations.find((r) => r.code !== 0).error, /INVITE_REVOKED|LOAN_NOT_PENDING/);
  const joined = invitations[0].code === 0;
  assert.equal((await state(fourth.loan_id)).status, joined ? 'ACTIVE' : 'PENDING');
  const membership = await sql(
    `select count(*) from public.loan_members where loan_id='${fourth.loan_id}' and user_id='${b}' and membership_status='ACCEPTED'`,
  );
  assert.equal(Number(membership.output), joined ? 1 : 0);
  console.log('PASS join versus revoke: one winner, membership consistent, no deadlock');

  await sql(
    `insert into auth.users(id,email) values ('${deleting}','${deleting}@example.invalid');
     insert into auth.sessions(id,user_id,created_at) values ('${deletingSession}','${deleting}',now())`,
  );
  await sql(
    `begin; set local role authenticated;
     set local request.jwt.claims='{"sub":"${deleting}","session_id":"${deletingSession}"}';
     select public.request_account_deletion(); commit;`,
  );
  const deletionRace = await accountRace(deleting, [
    `select public.claim_account_deletion('${deleting}')`,
    asUser(
      deleting,
      `select public.create_loan('LENDER',1000,'VND','2026-09-01','2026-10-01',null,null,'${randomUUID()}')`,
    ),
  ]);
  assert.equal(deletionRace.filter((result) => result.code === 0).length, 1);
  const deletionFailure = deletionRace.find((result) => result.code !== 0).error;
  assert.match(deletionFailure, /ACCOUNT_DELETION_BLOCKED|ACCOUNT_DELETION_IN_PROGRESS/);
  const createdDuringRace = deletionRace.find(
    (result) => result.code === 0 && result.output.includes('loan_id'),
  );
  if (createdDuringRace) loans.push(JSON.parse(createdDuringRace.output).loan_id);
  const deletionState = await sql(
    `select jsonb_build_object(
       'request_status',(select status from public.account_deletion_requests where user_id='${deleting}'),
       'blocking_loans',(select count(*) from public.loans where created_by='${deleting}' and status in ('DRAFT','PENDING','ACTIVE'))
     )`,
  );
  const raced = JSON.parse(deletionState.output);
  assert.ok(
    (raced.request_status === 'PROCESSING' && raced.blocking_loans === 0) ||
      (raced.request_status === 'PENDING' && raced.blocking_loans === 1),
  );
  console.log('PASS deletion versus new loan: one winner, no obligation created after claim');
} finally {
  // Every predicate uses random fixture IDs created by this process.
  if (loans.length) {
    const ids = loans.map((id) => `'${id}'`).join(',');
    await sql(
      `begin; delete from public.loan_events where loan_id in (${ids}); delete from public.repayments where loan_id in (${ids}); delete from public.loan_invites where loan_id in (${ids}); delete from public.loan_members where loan_id in (${ids}); delete from public.loans where id in (${ids}); commit;`,
    );
  }
  await sql(
    `delete from private.account_deletion_audit where former_user_id='${deleting}';
     delete from auth.users where id in ('${a}','${b}','${deleting}')`,
  );
}
