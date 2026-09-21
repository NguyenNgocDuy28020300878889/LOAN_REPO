begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id, email) values
 ('71000000-0000-4000-8000-000000000001','flow-a@example.invalid'),
 ('71000000-0000-4000-8000-000000000002','flow-b@example.invalid'),
 ('71000000-0000-4000-8000-000000000003','flow-c@example.invalid');
create temporary table flow_results (name text primary key, result jsonb);
grant all on flow_results to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';
insert into flow_results values ('first', public.create_loan('LENDER', 1000, 'VND', '2026-09-01', '2026-10-01', null, null, '72000000-0000-4000-8000-000000000001'));
select is((select result->>'status' from flow_results where name='first'), 'PENDING', 'Real create RPC succeeds on clean Supabase schema');
select is((public.get_loan_invite_preview((select result->>'invite_token' from flow_results where name='first'))->>'principal_minor')::bigint, 1000::bigint, 'Authenticated holder can preview');
select throws_ok($$select public.accept_loan_invite((select result->>'invite_token' from flow_results where name='first'), '72000000-0000-4000-8000-000000000002')$$, 'P0001', 'USER_ALREADY_MEMBER', 'Creator cannot join own invite');
select throws_ok($$select public.decline_loan_invite((select result->>'invite_token' from flow_results where name='first'), '72000000-0000-4000-8000-000000000003')$$, 'P0001', 'USER_ALREADY_MEMBER', 'Creator cannot decline own invite as counterparty');
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000002';
select lives_ok($$select public.accept_loan_invite((select result->>'invite_token' from flow_results where name='first'), '72000000-0000-4000-8000-000000000004')$$, 'Any authenticated valid link holder can join without email binding');
select is((public.get_loan_room((select (result->>'loan_id')::uuid from flow_results where name='first'))->>'status'), 'ACTIVE', 'Both-party flow activates room');
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000003';
select throws_ok($$select public.accept_loan_invite((select result->>'invite_token' from flow_results where name='first'), '72000000-0000-4000-8000-000000000005')$$, 'P0001', 'INVITE_ALREADY_USED', 'Third user cannot consume accepted link');
select throws_ok($$select public.get_loan_room((select (result->>'loan_id')::uuid from flow_results where name='first'))$$, '42501', null, 'Link possession after accept does not confer room access');
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';
insert into flow_results values ('second', public.create_loan('BORROWER', 2000, 'VND', '2026-09-01', '2026-10-01', null, null, '72000000-0000-4000-8000-000000000006'));
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000003';
select lives_ok($$select public.decline_loan_invite((select result->>'invite_token' from flow_results where name='second'), '72000000-0000-4000-8000-000000000007')$$, 'Valid link holder can decline');
reset role;
select is((select status::text from public.loans where id=(select (result->>'loan_id')::uuid from flow_results where name='second')), 'DECLINED', 'Decline persists');
select ok(not has_function_privilege('anon','public.get_loan_invite_preview(text)','execute'), 'Anonymous callers cannot read financial preview');
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$select public.get_loan_invite_preview(repeat('a',64))$$, '42501', null, 'Anonymous direct RPC is denied');
reset role;
select * from finish();
rollback;
