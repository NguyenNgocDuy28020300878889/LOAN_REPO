begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table private.account_deletion_audit
  add column if not exists attempt_count integer not null default 0
    check (attempt_count between 0 and 20),
  add column if not exists last_attempt_at timestamptz;

create or replace function private.lock_accounts(user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_uuid uuid;
begin
  for user_uuid in
    select distinct candidate
    from unnest(user_ids) candidate
    where candidate is not null
    order by candidate
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('loan-account:' || user_uuid::text, 0)
    );
  end loop;
end;
$$;

create or replace function private.assert_accounts_mutable(user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_accounts(user_ids);

  if exists (
    select 1
    from public.account_deletion_requests request_row
    where request_row.user_id = any(user_ids)
      and request_row.status in ('PROCESSING', 'COMPLETED')
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
end;
$$;

create or replace function private.loan_account_ids(loan_uuid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct account_id order by account_id), '{}'::uuid[])
  from (
    select loan.created_by as account_id
    from public.loans loan
    where loan.id = loan_uuid
    union
    select member.user_id
    from public.loan_members member
    where member.loan_id = loan_uuid
  ) accounts
  where account_id is not null;
$$;

create or replace function private.guard_loan_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_ids uuid[];
begin
  if tg_op = 'INSERT' then
    account_ids := array[new.created_by];
  else
    account_ids := private.loan_account_ids(new.id) || array[new.created_by, old.created_by];
  end if;
  perform private.assert_accounts_mutable(account_ids);
  return new;
end;
$$;

create or replace function private.guard_loan_member_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_ids uuid[];
begin
  -- ON DELETE SET NULL anonymisation must remain possible while Auth deletes a user.
  if tg_op = 'UPDATE'
     and new.user_id is null
     and old.user_id is not null
     and (new.loan_id, new.role, new.membership_status, new.joined_at)
       is not distinct from (old.loan_id, old.role, old.membership_status, old.joined_at) then
    return new;
  end if;

  account_ids := private.loan_account_ids(new.loan_id) || array[new.user_id];
  if tg_op = 'UPDATE' then
    account_ids := account_ids || private.loan_account_ids(old.loan_id) || array[old.user_id];
  end if;
  perform private.assert_accounts_mutable(account_ids);
  return new;
end;
$$;

create or replace function private.guard_loan_invite_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_ids uuid[];
begin
  account_ids := private.loan_account_ids(new.loan_id) || array[new.created_by];
  if tg_op = 'UPDATE' then
    account_ids := account_ids || private.loan_account_ids(old.loan_id) || array[old.created_by];
  end if;
  perform private.assert_accounts_mutable(account_ids);
  return new;
end;
$$;

create or replace function private.guard_repayment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_ids uuid[];
begin
  account_ids := private.loan_account_ids(new.loan_id) || array[new.created_by];
  if tg_op = 'UPDATE' then
    account_ids := account_ids || private.loan_account_ids(old.loan_id) || array[old.created_by];
  end if;
  perform private.assert_accounts_mutable(account_ids);
  return new;
end;
$$;

create or replace function private.guard_push_device_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_accounts_mutable(array[new.user_id]);
  return new;
end;
$$;

drop trigger if exists account_deletion_guard_loans on public.loans;
create trigger account_deletion_guard_loans
  before insert or update of principal_minor, currency, loan_date, due_date, purpose, note, status, closed_at
  on public.loans for each row execute function private.guard_loan_mutation();

drop trigger if exists account_deletion_guard_loan_members on public.loan_members;
create trigger account_deletion_guard_loan_members
  before insert or update on public.loan_members
  for each row execute function private.guard_loan_member_mutation();

drop trigger if exists account_deletion_guard_loan_invites on public.loan_invites;
create trigger account_deletion_guard_loan_invites
  before insert or update of loan_id, target_role, token_hash, expires_at, used_at, revoked_at
  on public.loan_invites for each row execute function private.guard_loan_invite_mutation();

drop trigger if exists account_deletion_guard_repayments on public.repayments;
create trigger account_deletion_guard_repayments
  before insert or update of loan_id, amount_minor, payment_date, method, note, status
  on public.repayments for each row execute function private.guard_repayment_mutation();

drop trigger if exists account_deletion_guard_push_devices on private.push_devices;
create trigger account_deletion_guard_push_devices
  before insert or update on private.push_devices
  for each row execute function private.guard_push_device_mutation();

create or replace function public.claim_account_deletion(user_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_deletion_requests;
  blockers jsonb;
  audit_id uuid;
begin
  perform private.lock_accounts(array[user_id_input]);

  select * into request_row
  from public.account_deletion_requests
  where user_id = user_id_input
  for update;

  if request_row.id is null then
    raise exception 'DELETION_REQUEST_REQUIRED' using errcode = 'P0001';
  end if;
  if request_row.requested_at < statement_timestamp() - interval '15 minutes' then
    raise exception 'REAUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if request_row.status = 'COMPLETED' then
    return jsonb_build_object('status', 'COMPLETED');
  end if;
  if request_row.status = 'PROCESSING'
     and request_row.processing_started_at >= statement_timestamp() - interval '5 minutes' then
    raise exception 'DELETION_ALREADY_PROCESSING' using errcode = 'P0001';
  end if;

  blockers := private.account_deletion_blockers(user_id_input);
  if not (blockers ->> 'eligible')::boolean then
    raise exception 'ACCOUNT_DELETION_BLOCKED' using errcode = 'P0001', detail = blockers::text;
  end if;

  update private.account_deletion_audit
  set outcome = 'FAILED', processed_at = statement_timestamp(), failure_reason = 'STALE_RECLAIM'
  where request_id = request_row.id and outcome = 'PROCESSING';

  update public.account_deletion_requests
  set status = 'PROCESSING', processing_started_at = statement_timestamp(), failure_reason = null
  where id = request_row.id;

  insert into private.account_deletion_audit (
    former_user_id, requested_at, processed_at, outcome, request_id, attempt_count, last_attempt_at
  ) values (
    user_id_input, request_row.requested_at, statement_timestamp(), 'PROCESSING', request_row.id, 1,
    statement_timestamp()
  )
  returning id into audit_id;

  return jsonb_build_object(
    'status', 'PROCESSING',
    'request_id', request_row.id,
    'audit_id', audit_id
  );
end;
$$;

create or replace function public.lease_account_deletion_reconciliations(limit_input integer default 10)
returns table(audit_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if limit_input < 1 or limit_input > 50 then
    raise exception 'INVALID_RECONCILIATION_LIMIT' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select audit.id
    from private.account_deletion_audit audit
    join public.account_deletion_requests request_row on request_row.id = audit.request_id
    where audit.outcome = 'PROCESSING'
      and audit.attempt_count < 5
      and request_row.status = 'PROCESSING'
      and request_row.processing_started_at < statement_timestamp() - interval '5 minutes'
    order by request_row.processing_started_at, audit.id
    for update of audit, request_row skip locked
    limit limit_input
  ), leased as (
    update private.account_deletion_audit audit
    set attempt_count = audit.attempt_count + 1,
        last_attempt_at = statement_timestamp(),
        failure_reason = null
    from candidates
    where audit.id = candidates.id
    returning audit.id, audit.former_user_id, audit.request_id
  )
  update public.account_deletion_requests request_row
  set processing_started_at = statement_timestamp(), failure_reason = null
  from leased
  where request_row.id = leased.request_id
  returning leased.id, leased.former_user_id;
end;
$$;

create or replace function public.record_account_deletion_attempt_failure(
  audit_id_input uuid,
  user_id_input uuid,
  failure_reason_input text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_reason text := left(coalesce(nullif(trim(failure_reason_input), ''), 'RECONCILIATION_FAILED'), 100);
begin
  update private.account_deletion_audit
  set failure_reason = safe_reason, processed_at = statement_timestamp()
  where id = audit_id_input
    and former_user_id = user_id_input
    and outcome = 'PROCESSING';

  if not found then
    raise exception 'DELETION_AUDIT_NOT_CLAIMED' using errcode = 'P0001';
  end if;

  update public.account_deletion_requests
  set failure_reason = safe_reason
  where user_id = user_id_input and status = 'PROCESSING';
end;
$$;

revoke all on function private.lock_accounts(uuid[]) from public, anon, authenticated;
revoke all on function private.assert_accounts_mutable(uuid[]) from public, anon, authenticated;
revoke all on function private.loan_account_ids(uuid) from public, anon, authenticated;
revoke all on function private.guard_loan_mutation() from public, anon, authenticated;
revoke all on function private.guard_loan_member_mutation() from public, anon, authenticated;
revoke all on function private.guard_loan_invite_mutation() from public, anon, authenticated;
revoke all on function private.guard_repayment_mutation() from public, anon, authenticated;
revoke all on function private.guard_push_device_mutation() from public, anon, authenticated;
revoke all on function public.lease_account_deletion_reconciliations(integer)
  from public, anon, authenticated;
grant execute on function public.lease_account_deletion_reconciliations(integer) to service_role;
revoke all on function public.record_account_deletion_attempt_failure(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_account_deletion_attempt_failure(uuid, uuid, text)
  to service_role;

commit;
