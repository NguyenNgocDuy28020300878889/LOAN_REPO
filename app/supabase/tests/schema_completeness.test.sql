begin;
create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
select no_plan();

select ok(not exists (
  select 1 from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public' and relation.relkind = 'r' and not relation.relrowsecurity
), 'All public tables enable RLS');

select ok(not exists (
  select 1 from pg_tables tables
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) commands(command)
  where tables.schemaname = 'public' and not exists (
    select 1 from pg_policies policies where policies.schemaname = 'public'
    and policies.tablename = tables.tablename and policies.cmd in (commands.command, 'ALL')
  )
), 'Every public table explicitly covers SELECT INSERT UPDATE DELETE');

select ok(not exists (
  select 1 from pg_tables tables where tables.schemaname = 'public' and not exists (
    select 1 from pg_constraint constraint_row
    join pg_attribute attribute on attribute.attrelid = constraint_row.conrelid
      and attribute.attnum = constraint_row.conkey[1]
    where constraint_row.conrelid = format('public.%I', tables.tablename)::regclass
      and constraint_row.contype = 'p' and cardinality(constraint_row.conkey) = 1
      and attribute.atttypid = 'uuid'::regtype
  )
), 'Each public primary key is one UUID');

select ok(not exists (
  select 1 from pg_constraint foreign_key join pg_namespace namespace on namespace.oid = foreign_key.connamespace
  where namespace.nspname = 'public' and foreign_key.contype = 'f' and not exists (
    select 1 from pg_index index_row
    where index_row.indrelid = foreign_key.conrelid and index_row.indisvalid
      and index_row.indpred is null
      and (index_row.indkey::smallint[])[0:cardinality(foreign_key.conkey)-1] @> foreign_key.conkey
  )
), 'Every public foreign key has a covering leading index');

select ok(not exists (
  select 1 from information_schema.columns column_row
  where column_row.table_schema = 'public' and column_row.column_name = 'updated_at'
    and not exists (
      select 1 from pg_trigger trigger_row
      where trigger_row.tgrelid = format('public.%I', column_row.table_name)::regclass
        and trigger_row.tgfoid = 'public.set_updated_at()'::regprocedure
        and not trigger_row.tgisinternal and trigger_row.tgenabled = 'O'
    )
), 'All mutable timestamp columns have enabled triggers');

select ok(not has_table_privilege('anon', 'public.profiles', 'TRUNCATE'), 'Anonymous cannot truncate profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE'), 'Signed-in users cannot truncate profiles');
select ok(not has_table_privilege('authenticated', 'public.loan_events', 'DELETE'), 'Audit deletion privilege remains denied');

insert into auth.users (id, email) values
  ('93000000-0000-4000-8000-000000000001', 'schema-a@example.invalid'),
  ('93000000-0000-4000-8000-000000000002', 'schema-b@example.invalid');
insert into public.loans(id, principal_minor, currency, loan_date, due_date, created_by)
values ('94000000-0000-4000-8000-000000000001', 1000, 'VND', '2026-09-01', '2026-10-01', '93000000-0000-4000-8000-000000000001');
insert into public.loan_members(loan_id, user_id, role, membership_status, joined_at)
values ('94000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'LENDER', 'ACCEPTED', now());

select throws_ok($$insert into public.loan_invites(loan_id,target_role,token_hash,expires_at)
  values ('94000000-0000-4000-8000-000000000001','BORROWER',repeat('b',64),now()+interval '1 day')$$,
  '23503', null, 'Invitation cannot reference a missing member role');
select throws_ok($$insert into public.loan_events(loan_id,event_type,entity_type,entity_id)
  values ('94000000-0000-4000-8000-000000000001','REPAYMENT_SUBMITTED','repayment','95000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'Audit event cannot reference an absent repayment');
select throws_ok($$insert into public.loan_events(loan_id,event_type,metadata)
  values ('94000000-0000-4000-8000-000000000001','TEST','[]')$$,
  '23514', null, 'Audit metadata must be an object');
select throws_ok($$insert into public.loan_events(loan_id,event_type,entity_id)
  values ('94000000-0000-4000-8000-000000000001','TEST','95000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'Audit entity cannot omit entity type');

grant select, insert, update, delete on all tables in schema public to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '93000000-0000-4000-8000-000000000002';
select is((select count(*) from public.loans where id='94000000-0000-4000-8000-000000000001'), 0::bigint, 'Outsider cannot read loan even when granted SELECT');
set local request.jwt.claim.sub = '93000000-0000-4000-8000-000000000001';
select is((select count(*) from public.loans where id='94000000-0000-4000-8000-000000000001'), 1::bigint, 'Member can read loan');
select throws_ok($$insert into public.loans(principal_minor,currency,loan_date,due_date,created_by)
  values(1000,'VND','2026-09-01','2026-10-01',auth.uid())$$,
  '42501', null, 'RLS blocks direct financial INSERT even if granted');
with modified as (update public.loans set purpose='unauthorized' where id='94000000-0000-4000-8000-000000000001' returning id)
select is((select count(*) from modified), 0::bigint, 'RLS blocks direct financial UPDATE');
with removed as (delete from public.loans where id='94000000-0000-4000-8000-000000000001' returning id)
select is((select count(*) from removed), 0::bigint, 'RLS blocks direct financial DELETE');
select is((select count(*) from public.idempotency_keys), 0::bigint, 'Raw command receipts stay hidden even if SELECT is granted');
select is((select count(*) from public.loan_invites), 0::bigint, 'Invitation table stays hidden even if SELECT is granted');
set local role postgres;

update public.loan_members set updated_at='2000-01-01' where loan_id='94000000-0000-4000-8000-000000000001';
select ok((select updated_at > '2000-01-01'::timestamptz from public.loan_members where loan_id='94000000-0000-4000-8000-000000000001'), 'Trigger prevents forged update timestamp');

select * from finish();
rollback;
