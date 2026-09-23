begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is(
  (
    select pronargdefaults::integer
    from pg_proc
    where oid = 'public.create_loan(public.loan_role,bigint,text,date,date,text,text,uuid,text)'::regprocedure
  ),
  1,
  'Single create_loan contract defaults only its optional recipient argument'
);
select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname = 'public' and function_row.proname = 'create_loan'
  ),
  1::bigint,
  'Data API exposes one unambiguous create_loan function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_loan(public.loan_role,bigint,text,date,date,text,text,uuid,text)',
    'execute'
  ),
  'Anonymous callers cannot execute the current contract'
);

insert into auth.users (id, email) values
  ('a5100000-0000-4000-8000-000000000001', 'contract-owner@example.invalid'),
  ('a5100000-0000-4000-8000-000000000002', 'contract-recipient@example.invalid'),
  ('a5100000-0000-4000-8000-000000000003', 'contract-outsider@example.invalid');

create temporary table contract_results (name text primary key, result jsonb);
grant all on contract_results to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'a5100000-0000-4000-8000-000000000001';

insert into contract_results values (
  'legacy',
  public.create_loan(
    'LENDER', 1000, 'VND', '2026-09-01', '2026-10-01', null, null,
    'a5200000-0000-4000-8000-000000000001'
  )
);
select is(
  (select result->>'status' from contract_results where name = 'legacy'),
  'PENDING',
  'Installed clients may omit the optional recipient without ambiguity'
);
select is(
  (
    select invited.user_id
    from public.loan_members invited
    where invited.loan_id = (
      select (result->>'loan_id')::uuid from contract_results where name = 'legacy'
    ) and invited.membership_status = 'INVITED'
  ),
  null::uuid,
  'Legacy contract creates an unbound invitation'
);

-- Simulate a completed receipt written by migration 20260921140000 before
-- recipient email became part of the fingerprint.
reset role;
update public.idempotency_keys
set request_hash = encode(
  extensions.digest(
    jsonb_build_array(
      'LENDER'::public.loan_role,
      1000,
      'VND',
      '2026-09-01'::date,
      '2026-10-01'::date,
      null,
      null
    )::text,
    'sha256'
  ),
  'hex'
)
where user_id = 'a5100000-0000-4000-8000-000000000001'
  and command = 'create_loan'
  and key = 'a5200000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub = 'a5100000-0000-4000-8000-000000000001';
select is(
  public.create_loan(
    'LENDER', 1000, 'VND', '2026-09-01', '2026-10-01', null, null,
    'a5200000-0000-4000-8000-000000000001',
    'contract-outsider@example.invalid'
  ),
  (select result from contract_results where name = 'legacy'),
  'Completed receipt from the previous fingerprint remains replayable after upgrade'
);
select is(
  (select count(*) from public.loans),
  1::bigint,
  'Legacy receipt replay does not create another loan'
);

insert into contract_results values (
  'designated',
  public.create_loan(
    'BORROWER', 2000, 'VND', '2026-09-01', '2026-10-01', 'Contract test', null,
    'a5200000-0000-4000-8000-000000000002',
    '  CONTRACT-RECIPIENT@EXAMPLE.INVALID  '
  )
);
select is(
  (
    select invited.user_id
    from public.loan_members invited
    where invited.loan_id = (
      select (result->>'loan_id')::uuid from contract_results where name = 'designated'
    ) and invited.membership_status = 'INVITED'
  ),
  'a5100000-0000-4000-8000-000000000002'::uuid,
  'Recipient email is normalized and binds only the matching account'
);
select is(
  public.create_loan(
    'BORROWER', 2000, 'VND', '2026-09-01', '2026-10-01', 'Contract test', null,
    'a5200000-0000-4000-8000-000000000002',
    'contract-recipient@example.invalid'
  ),
  (select result from contract_results where name = 'designated'),
  'Same key and normalized recipient returns the same receipt'
);
select throws_ok(
  $$select public.create_loan(
    'BORROWER', 2000, 'VND', '2026-09-01', '2026-10-01', 'Contract test', null,
    'a5200000-0000-4000-8000-000000000002',
    'contract-outsider@example.invalid'
  )$$,
  'P0001',
  'IDEMPOTENCY_PAYLOAD_MISMATCH',
  'Same key cannot silently change the recipient hint'
);

set local request.jwt.claim.sub = 'a5100000-0000-4000-8000-000000000002';
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  1,
  'Designated recipient sees exactly their pending invitation'
);
select is(
  public.get_pending_invite_detail(
    (select (result->>'loan_id')::uuid from contract_results where name = 'designated')
  )->>'purpose',
  'Contract test',
  'Designated recipient can read invitation detail'
);

set local request.jwt.claim.sub = 'a5100000-0000-4000-8000-000000000003';
select is(
  jsonb_array_length(public.get_my_pending_invites()),
  0,
  'Outsider cannot discover another account invitation'
);
select throws_ok(
  format(
    'select public.get_pending_invite_detail(%L)',
    (select (result->>'loan_id')::uuid from contract_results where name = 'designated'
    )
  ),
  'P0002',
  'INVITE_NOT_FOUND',
  'Outsider receives the same not-found response for invitation detail'
);

set local request.jwt.claim.sub = 'a5100000-0000-4000-8000-000000000002';
select is(
  public.respond_to_invite(
    (select (result->>'loan_id')::uuid from contract_results where name = 'designated'),
    'accept',
    'a5200000-0000-4000-8000-000000000003'
  )->>'status',
  'ACTIVE',
  'Designated recipient can accept by loan id'
);
select is(
  public.respond_to_invite(
    (select (result->>'loan_id')::uuid from contract_results where name = 'designated'),
    'accept',
    'a5200000-0000-4000-8000-000000000003'
  )->>'status',
  'ACTIVE',
  'Invitation response retry returns its receipt'
);

reset role;
select * from finish();
rollback;
