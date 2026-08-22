create or replace function private.begin_idempotent_command(
  command_input text,
  key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  insert into public.idempotency_keys (user_id, command, key)
  values (auth.uid(), command_input, key_input)
  on conflict (user_id, command, key) do nothing;

  select response into existing_response
  from public.idempotency_keys
  where user_id = auth.uid() and command = command_input and key = key_input
  for update;

  if existing_response is not null then
    return existing_response;
  end if;

  return null;
end;
$$;

create or replace function private.complete_idempotent_command(
  command_input text,
  key_input uuid,
  response_input jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.idempotency_keys
  set response = response_input, completed_at = now()
  where user_id = auth.uid() and command = command_input and key = key_input;
$$;

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
  result := private.begin_idempotent_command('create_loan', idempotency_key_input);
  if result is not null then return result; end if;

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

  invite_token := encode(gen_random_bytes(32), 'hex');
  insert into public.loan_invites (loan_id, target_role, token_hash, expires_at, created_by)
  values (loan_id, target_role_value, encode(digest(invite_token, 'sha256'), 'hex'), now() + interval '14 days', auth.uid());

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
  result := private.begin_idempotent_command('accept_loan_invite', idempotency_key_input);
  if result is not null then return result; end if;

  select * into invite_row from public.loan_invites
  where token_hash = encode(digest(invite_token_input, 'sha256'), 'hex')
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
  result := private.begin_idempotent_command('decline_loan_invite', idempotency_key_input);
  if result is not null then return result; end if;
  select * into invite_row from public.loan_invites
  where token_hash = encode(digest(invite_token_input, 'sha256'), 'hex') for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null or invite_row.revoked_at is not null then raise exception 'INVITE_UNAVAILABLE'; end if;

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

grant execute on function public.create_loan(public.loan_role, bigint, text, date, date, text, text, uuid) to authenticated;
grant execute on function public.accept_loan_invite(text, uuid) to authenticated;
grant execute on function public.decline_loan_invite(text, uuid) to authenticated;
