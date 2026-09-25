begin;
create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select plan(42);

insert into auth.users (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'deletion-a@example.invalid'),
  ('d1000000-0000-4000-8000-000000000002', 'deletion-b@example.invalid'),
  ('d1000000-0000-4000-8000-000000000003', 'deletion-c@example.invalid');
insert into auth.sessions (id, user_id, created_at) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now()),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', now() - interval '16 minutes'),
  ('d2000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', now());

select ok(not has_function_privilege('anon', 'public.get_my_account_deletion_request()', 'execute'),
  'Anonymous callers cannot inspect deletion request');
select ok(has_function_privilege('authenticated', 'public.get_my_account_deletion_request()', 'execute'),
  'Authenticated callers can inspect their deletion request');
select ok(not has_function_privilege('anon', 'public.get_my_account_deletion_state()', 'execute'),
  'Anonymous callers cannot inspect deletion state');
select ok(has_function_privilege('authenticated', 'public.get_my_account_deletion_state()', 'execute'),
  'Authenticated callers can inspect their deletion state');
select ok(not has_function_privilege('anon', 'public.claim_account_deletion(uuid)', 'execute'),
  'Anonymous callers cannot claim deletion');
select ok(not has_function_privilege('authenticated', 'public.claim_account_deletion(uuid)', 'execute'),
  'Authenticated callers cannot claim deletion');
select ok(not has_function_privilege('anon', 'public.finish_account_deletion(uuid, uuid, text, text)', 'execute'),
  'Anonymous callers cannot finish deletion');
select ok(not has_function_privilege('authenticated', 'public.finish_account_deletion(uuid, uuid, text, text)', 'execute'),
  'Authenticated callers cannot finish deletion');
select ok(not has_function_privilege('anon', 'public.lease_account_deletion_reconciliations(integer)', 'execute'),
  'Anonymous callers cannot lease deletion reconciliation');
select ok(not has_function_privilege('authenticated', 'public.lease_account_deletion_reconciliations(integer)', 'execute'),
  'Authenticated callers cannot lease deletion reconciliation');
select ok(not has_function_privilege('anon', 'public.record_account_deletion_attempt_failure(uuid, uuid, text)', 'execute'),
  'Anonymous callers cannot record deletion reconciliation failures');
select ok(not has_function_privilege('authenticated', 'public.record_account_deletion_attempt_failure(uuid, uuid, text)', 'execute'),
  'Authenticated callers cannot record deletion reconciliation failures');
select ok(not has_function_privilege('anon', 'public.purge_account_deletion_audit(integer)', 'execute'),
  'Anonymous callers cannot purge deletion audit history');
select ok(not has_function_privilege('authenticated', 'public.purge_account_deletion_audit(integer)', 'execute'),
  'Authenticated callers cannot purge deletion audit history');

insert into public.loans (
  id, principal_minor, currency, loan_date, due_date, purpose, note, status, created_by, closed_at
) values (
  'd3000000-0000-4000-8000-000000000002', 1000, 'VND', current_date - 2,
  current_date - 1, 'Private purpose', 'Private note', 'CLOSED',
  'd1000000-0000-4000-8000-000000000001', now()
);
insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at) values
  ('d3000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001',
   'LENDER', 'ACCEPTED', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001"}';
select is(public.get_my_account_deletion_request(), null::jsonb,
  'No request returns null without exposing another account');
select is((public.get_my_account_deletion_state() ->> 'eligible')::boolean, true,
  'State reports eligible with zero blockers when user has no loans');
select is((public.request_account_deletion()).status, 'PENDING',
  'A recent session can create a pending request');
select is(public.get_my_account_deletion_request() ->> 'user_id',
  'd1000000-0000-4000-8000-000000000001', 'Status belongs to the caller');
select is((public.request_account_deletion()).status, 'PENDING',
  'Repeating a pending request is idempotent');
set local role postgres;

update public.account_deletion_requests
set status = 'PROCESSING'
where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001"}';
select is((public.request_account_deletion()).status, 'PROCESSING',
  'Repeating a request cannot move processing work backwards');
set local role postgres;

update public.account_deletion_requests
set status = 'FAILED', failure_reason = 'SYNTHETIC_FAILURE'
where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001"}';
select is((public.request_account_deletion()).status, 'PENDING',
  'A failed request can be retried');
select is((public.get_my_account_deletion_request() ->> 'failure_reason'), null::text,
  'Retry clears the internal failure marker');
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000002","session_id":"d2000000-0000-4000-8000-000000000002"}';
select throws_ok('select public.request_account_deletion()', '28000', 'REAUTHENTICATION_REQUIRED',
  'An old session must authenticate again');
select is(public.get_my_account_deletion_request(), null::jsonb,
  'A caller cannot read another account request');
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000002"}';
select throws_ok('select public.request_account_deletion()', '28000', 'REAUTHENTICATION_REQUIRED',
  'A token without a session identifier cannot request deletion');
set local role postgres;

-- Test blockers with an active loan on user 3
insert into public.loans (id, principal_minor, currency, loan_date, due_date, status, created_by) values
  ('d3000000-0000-4000-8000-000000000001', 500000, 'VND', current_date, current_date + 30, 'ACTIVE', 'd1000000-0000-4000-8000-000000000003');
insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at) values
  ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'LENDER', 'ACCEPTED', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000003","session_id":"d2000000-0000-4000-8000-000000000003"}';
select is((public.get_my_account_deletion_state() ->> 'eligible')::boolean, false,
  'An active loan makes the user ineligible for deletion');
select throws_ok('select public.request_account_deletion()', 'P0001', 'ACCOUNT_DELETION_BLOCKED',
  'An active loan blocks request_account_deletion');
set local role postgres;

-- Test claim and finish as service_role for user 1
do $$
declare
  claim_result jsonb;
begin
  claim_result := public.claim_account_deletion('d1000000-0000-4000-8000-000000000001');
end;
$$;

select is(
  (select status from public.account_deletion_requests where user_id = 'd1000000-0000-4000-8000-000000000001'),
  'PROCESSING',
  'Claiming deletion moves request status to PROCESSING'
);
select is(
  (select attempt_count from private.account_deletion_audit
   where former_user_id = 'd1000000-0000-4000-8000-000000000001'
   order by processed_at desc limit 1),
  1,
  'Initial deletion execution records its first attempt'
);
select is(
  (select affected_loan_ids[1] from private.account_deletion_audit
   where former_user_id = 'd1000000-0000-4000-8000-000000000001'
   order by processed_at desc limit 1),
  'd3000000-0000-4000-8000-000000000002'::uuid,
  'Deletion audit captures the affected shared history before Auth deletion'
);
select throws_ok(
  $$update public.loans set note = 'blocked' where id = 'd3000000-0000-4000-8000-000000000002'$$,
  '55000', 'ACCOUNT_DELETION_IN_PROGRESS',
  'A processing deletion blocks loan mutation'
);
select throws_ok(
  $$insert into public.repayments (
      loan_id, amount_minor, payment_date, status, created_by
    ) values (
      'd3000000-0000-4000-8000-000000000002', 1, current_date, 'PENDING',
      'd1000000-0000-4000-8000-000000000001'
    )$$,
  '55000', 'ACCOUNT_DELETION_IN_PROGRESS',
  'A processing deletion blocks repayment creation'
);
select throws_ok(
  $$insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at)
    values (
      'd3000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000002', 'BORROWER', 'ACCEPTED', now()
    )$$,
  '55000', 'ACCOUNT_DELETION_IN_PROGRESS',
  'A processing deletion blocks membership changes involving the account'
);
select throws_ok(
  $$insert into private.push_devices (
      id, secret_hash, user_id, session_id, expo_token, platform, timezone, locale
    ) values (
      'd4000000-0000-4000-8000-000000000001', repeat('a', 64),
      'd1000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000001',
      'ExpoPushToken[deletion-test]', 'android', 'UTC', 'en'
    )$$,
  '55000', 'ACCOUNT_DELETION_IN_PROGRESS',
  'A processing deletion blocks push-device registration'
);

update public.account_deletion_requests
set processing_started_at = statement_timestamp() - interval '6 minutes'
where user_id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select user_id from public.lease_account_deletion_reconciliations(1)),
  'd1000000-0000-4000-8000-000000000001'::uuid,
  'A stale processing deletion can be leased for reconciliation'
);
select is(
  (select attempt_count from private.account_deletion_audit
   where former_user_id = 'd1000000-0000-4000-8000-000000000001'
   order by processed_at desc limit 1),
  2,
  'Reconciliation lease increments the durable attempt counter'
);
do $$
declare
  latest_audit_id uuid;
begin
  select id into latest_audit_id
  from private.account_deletion_audit
  where former_user_id = 'd1000000-0000-4000-8000-000000000001'
  order by processed_at desc limit 1;
  perform public.record_account_deletion_attempt_failure(
    latest_audit_id, 'd1000000-0000-4000-8000-000000000001', 'SYNTHETIC_RETRY'
  );
end;
$$;
select is(
  (select failure_reason from public.account_deletion_requests
   where user_id = 'd1000000-0000-4000-8000-000000000001'),
  'SYNTHETIC_RETRY',
  'A reconciliation failure remains visible for operations'
);

do $$
declare
  latest_audit_id uuid;
begin
  select id into latest_audit_id
  from private.account_deletion_audit
  where former_user_id = 'd1000000-0000-4000-8000-000000000001'
  order by processed_at desc limit 1;
  perform public.finish_account_deletion(
    latest_audit_id, 'd1000000-0000-4000-8000-000000000001', 'COMPLETED'
  );
end;
$$;
select is(
  (select outcome from private.account_deletion_audit where former_user_id = 'd1000000-0000-4000-8000-000000000001' order by processed_at desc limit 1),
  'COMPLETED',
  'Finish account deletion marks audit outcome as COMPLETED'
);
select is(
  (select purpose from public.loans where id = 'd3000000-0000-4000-8000-000000000002'),
  null::text,
  'Completing deletion removes free-text purpose from retained history'
);
select is(
  (select note from public.loans where id = 'd3000000-0000-4000-8000-000000000002'),
  null::text,
  'Completing deletion removes free-text note from retained history'
);

insert into private.account_deletion_audit (
  id, former_user_id, requested_at, processed_at, outcome
) values (
  'd5000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000099',
  statement_timestamp() - interval '200 days',
  statement_timestamp() - interval '200 days',
  'COMPLETED'
);
select is(public.purge_account_deletion_audit(180), 1,
  'Service maintenance purges completed deletion audit after 180 days');
select throws_ok(
  'select public.purge_account_deletion_audit(1)',
  '22023', 'INVALID_AUDIT_RETENTION',
  'Audit retention cannot be shortened below the policy floor'
);

select * from finish(true);
rollback;
