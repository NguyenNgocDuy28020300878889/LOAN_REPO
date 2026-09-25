begin;
create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select plan(11);

select ok(not has_schema_privilege('anon', 'private', 'usage'),
  'Anonymous role cannot use the private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'),
  'Authenticated role cannot address private helpers directly');
select ok(not exists(
  select 1 from pg_proc function_row
  join pg_namespace namespace on namespace.oid = function_row.pronamespace
  where namespace.nspname in ('public', 'private')
    and has_function_privilege('anon', function_row.oid, 'execute')
), 'Anonymous role cannot execute application functions');
select ok(not has_function_privilege('public', 'private.is_loan_member(uuid)', 'execute'),
  'Loan membership helper has no PUBLIC execute privilege');
select ok(not has_function_privilege('public', 'private.shares_loan_with(uuid)', 'execute'),
  'Shared participant helper has no PUBLIC execute privilege');
select ok(has_function_privilege('authenticated', 'private.is_loan_member(uuid)', 'execute'),
  'Authenticated RLS evaluation retains the loan membership helper');
select ok(has_function_privilege('authenticated', 'private.shares_loan_with(uuid)', 'execute'),
  'Authenticated RLS evaluation retains the shared participant helper');
select ok(not exists(
  select 1 from pg_proc function_row
  join pg_namespace namespace on namespace.oid = function_row.pronamespace
  where namespace.nspname = 'public'
    and function_row.proname in (
      'enqueue_due_push', 'claim_push_work', 'authorize_push_send', 'finish_push_work'
    )
    and has_function_privilege('authenticated', function_row.oid, 'execute')
), 'Authenticated clients cannot execute push worker RPCs');
select ok(not exists(
  select 1 from information_schema.role_table_grants grant_row
  where grant_row.grantee in ('anon', 'authenticated')
    and grant_row.table_schema = 'public'
    and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER')
), 'Client roles have no direct public table mutation or trigger privileges');
select ok(not has_table_privilege('authenticated', 'public.idempotency_keys', 'select'),
  'Authenticated clients cannot read raw command receipts');
select ok(not has_table_privilege('authenticated', 'public.loan_invites', 'select'),
  'Authenticated clients cannot read raw invitation tokens');

select * from finish(true);
rollback;
