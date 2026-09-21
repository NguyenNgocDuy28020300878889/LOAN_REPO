begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create extension if not exists pg_trgm with schema extensions;

create index loans_created_by_idx on public.loans(created_by);
create index loan_invites_created_by_idx on public.loan_invites(created_by);
create index repayments_created_by_idx on public.repayments(created_by);
create index repayments_confirmed_by_idx on public.repayments(confirmed_by);
create index repayments_disputed_by_idx on public.repayments(disputed_by);
create index loan_events_actor_id_idx on public.loan_events(actor_id);
create index loans_status_due_date_idx on public.loans(status, due_date);
create index loans_created_at_idx on public.loans(created_at desc);
create index loans_purpose_search_idx on public.loans using gin (purpose extensions.gin_trgm_ops);
create index loan_invites_loan_role_idx on public.loan_invites(loan_id, target_role);
create unique index repayments_loan_id_id_key on public.repayments(loan_id, id);
create index loan_events_loan_entity_idx on public.loan_events(loan_id, entity_id);

alter table public.loan_invites
  add constraint loan_invites_member_role_fkey foreign key (loan_id, target_role)
    references public.loan_members(loan_id, role) on delete restrict not valid,
  add constraint loan_invites_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$') not valid;
alter table public.loan_events
  add constraint loan_events_entity_pair check (
    (entity_type is null and entity_id is null)
    or (entity_type is not null and entity_type = 'repayment' and entity_id is not null)
  ) not valid,
  add constraint loan_events_repayment_fkey foreign key (loan_id, entity_id)
    references public.repayments(loan_id, id) on delete restrict not valid,
  add constraint loan_events_metadata_object check (jsonb_typeof(metadata) = 'object') not valid;
alter table public.idempotency_keys
  add constraint idempotency_request_hash_format
    check (request_hash is null or request_hash ~ '^[a-f0-9]{64}$') not valid;

alter table public.loan_invites validate constraint loan_invites_member_role_fkey;
alter table public.loan_invites validate constraint loan_invites_token_hash_format;
alter table public.loan_events validate constraint loan_events_entity_pair;
alter table public.loan_events validate constraint loan_events_repayment_fkey;
alter table public.loan_events validate constraint loan_events_metadata_object;
alter table public.idempotency_keys validate constraint idempotency_request_hash_format;

alter table public.loan_members add column updated_at timestamptz not null default now();
alter table public.loan_invites add column updated_at timestamptz not null default now();
alter table public.repayments add column updated_at timestamptz not null default now();
alter table public.idempotency_keys add column updated_at timestamptz not null default now();
alter table public.account_deletion_requests add column updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'loan_members', 'loan_invites', 'repayments', 'idempotency_keys',
    'account_deletion_requests', 'notification_preferences'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at', table_name);
  end loop;
end;
$$;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;

create policy "invites require RPC for reads" on public.loan_invites
  for select to authenticated using (false);
create policy "receipts require RPC for reads" on public.idempotency_keys
  for select to authenticated using (false);
create policy "users read their notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'loans', 'loan_members', 'loan_invites', 'repayments',
    'loan_events', 'idempotency_keys', 'account_deletion_requests', 'notification_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "direct insert requires RPC" on public.%I for insert to authenticated with check (false)', table_name);
    if table_name <> 'profiles' then
      execute format('create policy "direct update requires RPC" on public.%I for update to authenticated using (false) with check (false)', table_name);
    end if;
    execute format('create policy "direct delete denied" on public.%I for delete to authenticated using (false)', table_name);
  end loop;
end;
$$;

commit;
