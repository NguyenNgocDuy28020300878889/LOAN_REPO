begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'deletion-a@example.invalid'),
  ('d1000000-0000-4000-8000-000000000002', 'deletion-b@example.invalid');
insert into auth.sessions (id, user_id, created_at) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', now()),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', now() - interval '16 minutes');

select ok(not has_function_privilege('anon', 'public.get_my_account_deletion_request()', 'execute'),
  'Anonymous callers cannot inspect deletion status');
select ok(has_function_privilege('authenticated', 'public.get_my_account_deletion_request()', 'execute'),
  'Authenticated callers can inspect their deletion status');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001"}';
select is(public.get_my_account_deletion_request(), null::jsonb,
  'No request returns null without exposing another account');
select is((public.request_account_deletion()).status, 'PENDING',
  'A recent session can create a pending request');
select is(public.get_my_account_deletion_request() ->> 'user_id',
  'd1000000-0000-4000-8000-000000000001', 'Status belongs to the caller');
select is((public.request_account_deletion()).status, 'PENDING',
  'Repeating a pending request is idempotent');
reset role;

update public.account_deletion_requests
set status = 'PROCESSING'
where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1000000-0000-4000-8000-000000000001","session_id":"d2000000-0000-4000-8000-000000000001"}';
select is((public.request_account_deletion()).status, 'PROCESSING',
  'Repeating a request cannot move processing work backwards');
reset role;

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

select * from finish(true);
rollback;
