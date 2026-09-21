-- Bind command receipts to their canonical payload and lock each loan before
-- its repayments. Old receipts without fingerprints fail closed on retry.
alter table public.idempotency_keys add column request_hash text;
alter table public.loans add constraint loans_safe_integer check (principal_minor <= 9007199254740991);
alter table public.repayments add constraint repayments_safe_integer check (amount_minor <= 9007199254740991);

create or replace function private.begin_idempotent_command(command_input text, key_input uuid, payload_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare receipt public.idempotency_keys; fingerprint text;
begin
  if auth.uid() is null or not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if key_input is null then raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023'; end if;
  fingerprint := encode(extensions.digest(payload_input::text, 'sha256'), 'hex');
  insert into public.idempotency_keys(user_id, command, key, request_hash)
  values(auth.uid(), command_input, key_input, fingerprint)
  on conflict(user_id, command, key) do nothing;
  select * into receipt from public.idempotency_keys
  where user_id=auth.uid() and command=command_input and key=key_input for update;
  if receipt.request_hash is null then raise exception 'IDEMPOTENCY_LEGACY_RETRY_REJECTED'; end if;
  if receipt.request_hash <> fingerprint then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
  return receipt.response;
end; $$;
revoke execute on function private.begin_idempotent_command(text,uuid,jsonb) from public, anon, authenticated;
revoke execute on function private.begin_idempotent_command(text,uuid) from public, anon, authenticated;
revoke execute on function private.complete_idempotent_command(text,uuid,jsonb) from public, anon, authenticated;


create or replace function public.create_loan(
  creator_role_input public.loan_role,
  principal_minor_input bigint,
  currency_input text,
  loan_date_input date,
  due_date_input date,
  purpose_input text,
  note_input text,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  loan_id uuid;
  invite_token text;
  target_role_value public.loan_role;
begin
  result := private.begin_idempotent_command('create_loan', idempotency_key_input, jsonb_build_array(creator_role_input, principal_minor_input, currency_input, loan_date_input, due_date_input, purpose_input, note_input));
  if result is not null then
    if not private.is_loan_member((result->>'loan_id')::uuid) then raise exception 'LOAN_ACCESS_DENIED' using errcode='42501'; end if;
    if not exists (select 1 from public.loan_invites i where i.loan_id=(result->>'loan_id')::uuid and i.token_hash=encode(extensions.digest(result->>'invite_token','sha256'),'hex') and i.revoked_at is null and i.used_at is null and i.expires_at>now()) then
      result := result || jsonb_build_object('invite_token', null);
    end if;
    return result;
  end if;

  if principal_minor_input <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if currency_input !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if due_date_input < loan_date_input then raise exception 'INVALID_DUE_DATE'; end if;

  target_role_value := case when creator_role_input = 'LENDER' then 'BORROWER' else 'LENDER' end;
  insert into public.loans (principal_minor, currency, loan_date, due_date, purpose, note, status, created_by)
  values (principal_minor_input, currency_input, loan_date_input, due_date_input, purpose_input, note_input, 'PENDING', auth.uid())
  returning id into loan_id;

  insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at)
  values (loan_id, auth.uid(), creator_role_input, 'ACCEPTED', now());
  insert into public.loan_members (loan_id, role, membership_status)
  values (loan_id, target_role_value, 'INVITED');

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.loan_invites (loan_id, target_role, token_hash, expires_at, created_by)
  values (loan_id, target_role_value, encode(extensions.digest(invite_token, 'sha256'), 'hex'), now() + interval '14 days', auth.uid());

  insert into public.loan_events (loan_id, event_type, actor_id, metadata)
  values (loan_id, 'LOAN_CREATED', auth.uid(), jsonb_build_object('principal_minor', principal_minor_input, 'currency', currency_input));
  insert into public.loan_events (loan_id, event_type, actor_id, metadata)
  values (loan_id, 'INVITE_CREATED', auth.uid(), jsonb_build_object('target_role', target_role_value));

  result := jsonb_build_object('loan_id', loan_id, 'invite_token', invite_token, 'status', 'PENDING');
  perform private.complete_idempotent_command('create_loan', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.accept_loan_invite(invite_token_input text, idempotency_key_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  invite_row public.loan_invites;
  loan_row public.loans;
begin
  result := private.begin_idempotent_command('accept_loan_invite', idempotency_key_input, jsonb_build_array(invite_token_input));
  if result is not null then
    if not private.is_loan_member((result->>'loan_id')::uuid) then raise exception 'LOAN_ACCESS_DENIED' using errcode='42501'; end if;
    return result;
  end if;

  select * into invite_row from public.loan_invites
  where token_hash = encode(extensions.digest(invite_token_input, 'sha256'), 'hex')
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if invite_row.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;

  select * into loan_row from public.loans where id = invite_row.loan_id for update;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;
  if exists (select 1 from public.loan_members where loan_id = loan_row.id and user_id = auth.uid()) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  update public.loan_members
  set user_id = auth.uid(), membership_status = 'ACCEPTED', joined_at = now()
  where loan_id = loan_row.id and role = invite_row.target_role and membership_status = 'INVITED';
  if not found then raise exception 'INVITE_MEMBER_UNAVAILABLE'; end if;
  update public.loan_invites set used_at = now() where id = invite_row.id;
  update public.loans set status = 'ACTIVE' where id = loan_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id) values (loan_row.id, 'LOAN_ACCEPTED', auth.uid());

  result := jsonb_build_object('loan_id', loan_row.id, 'status', 'ACTIVE');
  perform private.complete_idempotent_command('accept_loan_invite', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.decline_loan_invite(invite_token_input text, idempotency_key_input uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  invite_row public.loan_invites;
begin
  result := private.begin_idempotent_command('decline_loan_invite', idempotency_key_input, jsonb_build_array(invite_token_input));
  if result is not null then return result; end if;
  select * into invite_row from public.loan_invites
  where token_hash = encode(extensions.digest(invite_token_input, 'sha256'), 'hex') for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null or invite_row.revoked_at is not null then raise exception 'INVITE_UNAVAILABLE'; end if;

  if exists (select 1 from public.loan_members where loan_id = invite_row.loan_id and user_id = auth.uid()) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  update public.loan_members set membership_status = 'DECLINED'
  where loan_id = invite_row.loan_id and role = invite_row.target_role and membership_status = 'INVITED';
  update public.loan_invites set used_at = now() where id = invite_row.id;
  update public.loans set status = 'DECLINED' where id = invite_row.loan_id and status = 'PENDING';
  insert into public.loan_events (loan_id, event_type, actor_id) values (invite_row.loan_id, 'LOAN_DECLINED', auth.uid());

  result := jsonb_build_object('loan_id', invite_row.loan_id, 'status', 'DECLINED');
  perform private.complete_idempotent_command('decline_loan_invite', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.submit_repayment(
  loan_id_input uuid, amount_minor_input bigint, payment_date_input date,
  method_input text, note_input text, idempotency_key_input uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; loan_row public.loans; repayment_id uuid; remaining bigint;
begin
  result := private.begin_idempotent_command('submit_repayment', idempotency_key_input, jsonb_build_array(loan_id_input, amount_minor_input, payment_date_input, method_input, note_input));
  if not private.is_loan_member(loan_id_input) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  if result is not null then return result; end if;
  select * into loan_row from public.loans where id = loan_id_input for update;
  if loan_row.status <> 'ACTIVE' then raise exception 'LOAN_NOT_ACTIVE'; end if;
  if amount_minor_input <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select loan_row.principal_minor - coalesce(sum(amount_minor), 0) into remaining from public.repayments where loan_id = loan_row.id and status = 'CONFIRMED';
  if amount_minor_input > remaining then raise exception 'REPAYMENT_EXCEEDS_REMAINING'; end if;
  insert into public.repayments (loan_id, amount_minor, payment_date, method, note, status, created_by)
  values (loan_row.id, amount_minor_input, payment_date_input, method_input, note_input, 'PENDING', auth.uid()) returning id into repayment_id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id, metadata)
  values (loan_row.id, 'REPAYMENT_SUBMITTED', auth.uid(), 'repayment', repayment_id, jsonb_build_object('amount_minor', amount_minor_input));
  result := jsonb_build_object('repayment_id', repayment_id, 'status', 'PENDING');
  perform private.complete_idempotent_command('submit_repayment', idempotency_key_input, result); return result;
end; $$;

create or replace function public.cancel_repayment(
  repayment_id_input uuid,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('cancel_repayment', idempotency_key_input, jsonb_build_array(repayment_id_input));
  select * into repayment_row from public.repayments
  where id = repayment_id_input;

  -- Do not treat SQL NULL comparisons as authorization. Check access even on retry.
  if not found then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id)
     or repayment_row.created_by is distinct from auth.uid() then
    raise exception 'CANNOT_CANCEL_OTHER_REPAYMENT' using errcode = '42501';
  end if;
  perform 1 from public.loans where id=repayment_row.loan_id for update;
  select * into repayment_row from public.repayments where id=repayment_id_input for update;
  if result is not null then return result; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;

  update public.repayments set status = 'CANCELLED' where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id)
  values (repayment_row.loan_id, 'REPAYMENT_CANCELLED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'CANCELLED');
  perform private.complete_idempotent_command('cancel_repayment', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.dispute_repayment(
  repayment_id_input uuid,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('dispute_repayment', idempotency_key_input, jsonb_build_array(repayment_id_input));
  select * into repayment_row from public.repayments
  where id = repayment_id_input;
  if not found then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id) then
    raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
  end if;
  if repayment_row.created_by is null or repayment_row.created_by = auth.uid() then
    raise exception 'CANNOT_DISPUTE_OWN_REPAYMENT' using errcode = '42501';
  end if;
  perform 1 from public.loans where id=repayment_row.loan_id for update;
  select * into repayment_row from public.repayments where id=repayment_id_input for update;
  if result is not null then return result; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;

  update public.repayments
  set status = 'DISPUTED', disputed_by = auth.uid(), disputed_at = now()
  where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id)
  values (repayment_row.loan_id, 'REPAYMENT_DISPUTED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'DISPUTED');
  perform private.complete_idempotent_command('dispute_repayment', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.confirm_repayment(repayment_id_input uuid, idempotency_key_input uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; repayment_row public.repayments; loan_row public.loans; remaining bigint;
begin
  result := private.begin_idempotent_command('confirm_repayment',idempotency_key_input,jsonb_build_array(repayment_id_input));
  select * into repayment_row from public.repayments where id=repayment_id_input;
  if not found then raise exception 'LOAN_ACCESS_DENIED' using errcode='42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id) then raise exception 'LOAN_ACCESS_DENIED' using errcode='42501'; end if;
  select * into loan_row from public.loans where id=repayment_row.loan_id for update;
  select * into repayment_row from public.repayments where id=repayment_id_input for update;
  if repayment_row.created_by = auth.uid() then raise exception 'CANNOT_CONFIRM_OWN_REPAYMENT' using errcode='42501'; end if;
  if result is not null then return result; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;
  if loan_row.status <> 'ACTIVE' then raise exception 'LOAN_NOT_ACTIVE'; end if;
  select loan_row.principal_minor - coalesce(sum(amount_minor),0) into remaining
  from public.repayments where loan_id=loan_row.id and status='CONFIRMED';
  if repayment_row.amount_minor > remaining then raise exception 'REPAYMENT_EXCEEDS_REMAINING'; end if;
  update public.repayments set status='CONFIRMED', confirmed_by=auth.uid(), confirmed_at=now() where id=repayment_row.id;
  insert into public.loan_events(loan_id,event_type,actor_id,entity_type,entity_id,metadata)
  values(loan_row.id,'REPAYMENT_CONFIRMED',auth.uid(),'repayment',repayment_row.id,jsonb_build_object('amount_minor',repayment_row.amount_minor));
  if repayment_row.amount_minor = remaining then
    update public.loans set status='REPAID' where id=loan_row.id;
    with cancelled as (
      update public.repayments set status='CANCELLED'
      where loan_id=loan_row.id and status='PENDING' returning id
    )
    insert into public.loan_events(loan_id,event_type,actor_id,entity_type,entity_id,metadata)
    select loan_row.id,'REPAYMENT_CANCELLED',auth.uid(),'repayment',id,
      jsonb_build_object('reason','LOAN_REPAID','automatic',true,'confirmed_repayment_id',repayment_row.id)
    from cancelled;
  end if;
  result := jsonb_build_object('repayment_id',repayment_row.id,'status','CONFIRMED','loan_status',case when repayment_row.amount_minor=remaining then 'REPAID' else 'ACTIVE' end);
  perform private.complete_idempotent_command('confirm_repayment',idempotency_key_input,result);
  return result;
end; $$;

-- Only application entry points are changed. Do not revoke extension/auth APIs.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature,p.proname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'create_loan','accept_loan_invite','decline_loan_invite','get_loan_invite_preview',
      'submit_repayment','confirm_repayment','cancel_repayment','dispute_repayment',
      'get_my_loans','get_loan_room','get_loan_repayments','ensure_my_profile',
      'get_my_notification_preferences','update_my_notification_preferences','request_account_deletion',
      'handle_new_user','set_updated_at'])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',fn.signature);
    if fn.proname not in ('handle_new_user','set_updated_at') then
      execute format('grant execute on function %s to authenticated',fn.signature);
    end if;
  end loop;
end; $$;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
revoke create on schema public from public, anon, authenticated;
