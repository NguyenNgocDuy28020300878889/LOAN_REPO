-- Synthetic users only. All fixtures and mutations roll back after this suite.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'loan-test-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'loan-test-b@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'loan-test-c@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'loan-test-deleted@example.invalid');

insert into public.loans (id, principal_minor, currency, loan_date, due_date, status, created_by) values
  ('20000000-0000-4000-8000-000000000001', 1000, 'USD', '2026-09-01', '2026-10-01', 'ACTIVE', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 1000, 'USD', '2026-09-01', '2026-10-01', 'ACTIVE', '10000000-0000-4000-8000-000000000004');
insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'LENDER', 'ACCEPTED', now()),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'BORROWER', 'ACCEPTED', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'LENDER', 'ACCEPTED', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'BORROWER', 'ACCEPTED', now());
insert into public.repayments (id, loan_id, amount_minor, payment_date, created_by) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 100, '2026-09-02', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 100, '2026-09-02', '10000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 100, '2026-09-02', '10000000-0000-4000-8000-000000000001');
delete from auth.users where id = '10000000-0000-4000-8000-000000000004';
select is((select created_by from public.repayments where id = '30000000-0000-4000-8000-000000000002'), null::uuid, 'Deletion fixture produces a NULL creator');

-- C has a valid user identity, but no membership. Never use service_role here.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.loans), 0::bigint, 'Outsider cannot read loans');
select is((select count(*) from public.repayments), 0::bigint, 'Outsider cannot read repayments');
select throws_ok($$select public.get_loan_room('20000000-0000-4000-8000-000000000001')$$, '42501', null, 'Outsider cannot read through definer RPC');
select throws_ok($$select public.cancel_repayment('30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001')$$, '42501', null, 'SEC-01: outsider cannot cancel a NULL-creator repayment');
reset role;
select is((select status::text from public.repayments where id = '30000000-0000-4000-8000-000000000002'), 'PENDING', 'Denied cancellation leaves repayment untouched');
select is((select count(*) from public.loan_events where loan_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'Denied cancellation creates no audit event');

-- A is the creator. Direct writes and self-confirm are denied.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok($$update public.loans set principal_minor = 1 where id = '20000000-0000-4000-8000-000000000001'$$, '42501', null, 'Participant cannot bypass RPC by updating loan directly');
select throws_ok($$delete from public.loan_events$$, '42501', null, 'Participant cannot delete shared audit');
select throws_ok($$select public.confirm_repayment('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002')$$, '42501', null, 'Creator cannot self-confirm');
select lives_ok($$select public.cancel_repayment('30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003')$$, 'Creator can cancel own pending repayment');
select lives_ok($$select public.cancel_repayment('30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003')$$, 'Retry cancellation returns the previous result');
select is((select count(*) from public.loan_events where entity_id = '30000000-0000-4000-8000-000000000003'), 1::bigint, 'Cancellation retry creates exactly one event');

-- B can dispute A's proposal. The database requires its timestamp.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok($$select public.cancel_repayment('30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000005')$$, '42501', null, 'Remaining member cannot cancel a NULL-creator repayment');
select throws_ok($$select public.cancel_repayment('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006')$$, '42501', null, 'Counterparty cannot cancel the authors proposal');
select lives_ok($$select public.dispute_repayment('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004')$$, 'Counterparty dispute satisfies audit constraints');
select is((select status::text from public.repayments where id = '30000000-0000-4000-8000-000000000001'), 'DISPUTED', 'Dispute persists correct state');
select ok((select disputed_at is not null from public.repayments where id = '30000000-0000-4000-8000-000000000001'), 'Dispute records timestamp');
select is((public.get_loan_room('20000000-0000-4000-8000-000000000001')->>'balance_minor')::bigint, 1000::bigint, 'Dispute does not reduce balance');
select lives_ok($$select public.dispute_repayment('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004')$$, 'Retry dispute returns previous result');
select is((select count(*) from public.loan_events where entity_id = '30000000-0000-4000-8000-000000000001'), 1::bigint, 'Dispute retry creates exactly one event');

reset role;
select ok(not has_function_privilege('anon', 'public.cancel_repayment(uuid,uuid)', 'execute'), 'Anonymous callers have no cancel EXECUTE grant');
select ok(not has_function_privilege('anon', 'public.dispute_repayment(uuid,uuid)', 'execute'), 'Anonymous callers have no dispute EXECUTE grant');
select * from finish();
rollback;
