begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table private.account_deletion_audit
  add column if not exists affected_loan_ids uuid[] not null default '{}'::uuid[];

create or replace function private.capture_account_deletion_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(array_agg(distinct loan_id order by loan_id), '{}'::uuid[])
  into new.affected_loan_ids
  from (
    select loan.id as loan_id
    from public.loans loan
    where loan.created_by = new.former_user_id
    union
    select member.loan_id
    from public.loan_members member
    where member.user_id = new.former_user_id
  ) affected;
  return new;
end;
$$;

drop trigger if exists capture_account_deletion_scope on private.account_deletion_audit;
create trigger capture_account_deletion_scope
  before insert on private.account_deletion_audit
  for each row execute function private.capture_account_deletion_scope();

create or replace function private.assert_accounts_mutable(user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleanup_user uuid := nullif(
    pg_catalog.current_setting('app.account_deletion_finalize_user', true), ''
  )::uuid;
begin
  perform private.lock_accounts(user_ids);

  if exists (
    select 1
    from public.account_deletion_requests request_row
    where request_row.user_id = any(user_ids)
      and request_row.status in ('PROCESSING', 'COMPLETED')
      and request_row.user_id is distinct from cleanup_user
  ) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.finish_account_deletion(
  audit_id_input uuid,
  user_id_input uuid,
  outcome_input text,
  failure_reason_input text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_row private.account_deletion_audit;
begin
  if outcome_input not in ('COMPLETED', 'FAILED') then
    raise exception 'INVALID_DELETION_OUTCOME' using errcode = '22023';
  end if;

  select * into audit_row
  from private.account_deletion_audit
  where id = audit_id_input
    and former_user_id = user_id_input
    and outcome = 'PROCESSING'
  for update;

  if audit_row.id is null then
    raise exception 'DELETION_AUDIT_NOT_CLAIMED' using errcode = 'P0001';
  end if;

  if outcome_input = 'COMPLETED' then
    perform pg_catalog.set_config(
      'app.account_deletion_finalize_user', user_id_input::text, true
    );

    update public.loans
    set purpose = null, note = null
    where id = any(audit_row.affected_loan_ids)
      and (purpose is not null or note is not null);

    update public.repayments
    set method = null, note = null
    where loan_id = any(audit_row.affected_loan_ids)
      and (method is not null or note is not null);
  end if;

  update private.account_deletion_audit
  set outcome = outcome_input,
      processed_at = statement_timestamp(),
      failure_reason = case when outcome_input = 'FAILED' then failure_reason_input else null end
  where id = audit_id_input;

  if outcome_input = 'FAILED' then
    update public.account_deletion_requests
    set status = 'FAILED', processing_started_at = null,
        failure_reason = coalesce(failure_reason_input, 'ACCOUNT_DELETION_FAILED')
    where user_id = user_id_input and status = 'PROCESSING';
  end if;
end;
$$;

revoke all on function private.capture_account_deletion_scope() from public, anon, authenticated;

commit;
