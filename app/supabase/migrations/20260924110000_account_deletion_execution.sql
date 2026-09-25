begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.account_deletion_requests
  add column if not exists processing_started_at timestamptz;

alter table private.account_deletion_audit
  drop constraint if exists account_deletion_audit_outcome_check,
  add constraint account_deletion_audit_outcome_check
    check (outcome in ('PROCESSING', 'COMPLETED', 'FAILED')),
  add column if not exists request_id uuid;

create index if not exists account_deletion_audit_request_id_idx
  on private.account_deletion_audit(request_id);

create or replace function private.account_deletion_blockers(user_uuid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with my_loans as (
    select distinct loan.id, loan.status
    from public.loans loan
    left join public.loan_members member on member.loan_id = loan.id
    where member.user_id = user_uuid or loan.created_by = user_uuid
  ), counts as (
    select
      coalesce(count(*) filter (where status in ('DRAFT', 'PENDING', 'ACTIVE')), 0) as loan_count,
      coalesce((
        select count(*)
        from public.repayments repayment
        join my_loans mine on mine.id = repayment.loan_id
        where repayment.status in ('PENDING', 'DISPUTED')
      ), 0) as repayment_count
    from my_loans
  )
  select jsonb_build_object(
    'blocking_loan_count', loan_count,
    'blocking_repayment_count', repayment_count,
    'eligible', loan_count = 0 and repayment_count = 0
  )
  from counts;
$$;

create or replace function public.get_my_account_deletion_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_deletion_blockers(auth.uid()) || jsonb_build_object(
    'request', (
      select to_jsonb(request_row)
      from public.account_deletion_requests request_row
      where request_row.user_id = auth.uid()
    )
  );
$$;

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.account_deletion_requests;
  blockers jsonb;
  session_id_text text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  if session_id_text is null
     or session_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or not exists (
       select 1
       from auth.sessions auth_session
       where auth_session.id = session_id_text::uuid
         and auth_session.user_id = auth.uid()
         and auth_session.created_at >= statement_timestamp() - interval '15 minutes'
     ) then
    raise exception 'REAUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  blockers := private.account_deletion_blockers(auth.uid());
  if not (blockers ->> 'eligible')::boolean then
    raise exception 'ACCOUNT_DELETION_BLOCKED' using errcode = 'P0001', detail = blockers::text;
  end if;

  insert into public.account_deletion_requests (user_id)
  values (auth.uid())
  on conflict (user_id) do update
    set requested_at = case
      when public.account_deletion_requests.status in ('COMPLETED', 'PROCESSING')
        then public.account_deletion_requests.requested_at
      else statement_timestamp()
    end,
    status = case
      when public.account_deletion_requests.status in ('COMPLETED', 'PROCESSING')
        then public.account_deletion_requests.status
      else 'PENDING'
    end,
    completed_at = case
      when public.account_deletion_requests.status = 'COMPLETED'
        then public.account_deletion_requests.completed_at
      else null
    end,
    processing_started_at = case
      when public.account_deletion_requests.status = 'PROCESSING'
        then public.account_deletion_requests.processing_started_at
      else null
    end,
    failure_reason = null
  returning * into result;

  return result;
end;
$$;

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
    former_user_id, requested_at, processed_at, outcome, request_id
  ) values (
    user_id_input, request_row.requested_at, statement_timestamp(), 'PROCESSING', request_row.id
  )
  returning id into audit_id;

  return jsonb_build_object(
    'status', 'PROCESSING',
    'request_id', request_row.id,
    'audit_id', audit_id
  );
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
begin
  if outcome_input not in ('COMPLETED', 'FAILED') then
    raise exception 'INVALID_DELETION_OUTCOME' using errcode = '22023';
  end if;

  update private.account_deletion_audit
  set outcome = outcome_input,
      processed_at = statement_timestamp(),
      failure_reason = case when outcome_input = 'FAILED' then failure_reason_input else null end
  where id = audit_id_input
    and former_user_id = user_id_input
    and outcome = 'PROCESSING';

  if not found then
    raise exception 'DELETION_AUDIT_NOT_CLAIMED' using errcode = 'P0001';
  end if;

  if outcome_input = 'FAILED' then
    update public.account_deletion_requests
    set status = 'FAILED', processing_started_at = null,
        failure_reason = coalesce(failure_reason_input, 'ACCOUNT_DELETION_FAILED')
    where user_id = user_id_input and status = 'PROCESSING';
  end if;
end;
$$;

revoke all on function private.account_deletion_blockers(uuid) from public, anon, authenticated;
revoke all on function public.get_my_account_deletion_state() from public, anon;
grant execute on function public.get_my_account_deletion_state() to authenticated;
revoke all on function public.claim_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.claim_account_deletion(uuid) to service_role;
revoke all on function public.finish_account_deletion(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_account_deletion(uuid, uuid, text, text) to service_role;

commit;
