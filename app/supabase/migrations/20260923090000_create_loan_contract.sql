begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Supabase's Data API requires one unambiguous function name. Remove both
-- historical overloads, then recreate a single contract whose final default
-- keeps installed clients that omit recipient_email_input compatible.
drop function public.create_loan(
  public.loan_role, bigint, text, date, date, text, text, uuid
);
drop function public.create_loan(
  public.loan_role, bigint, text, date, date, text, text, uuid, text
);

create or replace function public.create_loan(
  creator_role_input public.loan_role,
  principal_minor_input bigint,
  currency_input text,
  loan_date_input date,
  due_date_input date,
  purpose_input text,
  note_input text,
  idempotency_key_input uuid,
  recipient_email_input text default null
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
  resolved_recipient_id uuid;
  normalized_recipient_email text;
  legacy_payload jsonb;
  current_payload jsonb;
  legacy_fingerprint text;
  existing_fingerprint text;
begin
  normalized_recipient_email := nullif(lower(trim(recipient_email_input)), '');
  legacy_payload := jsonb_build_array(
    creator_role_input,
    principal_minor_input,
    currency_input,
    loan_date_input,
    due_date_input,
    purpose_input,
    note_input
  );
  current_payload := legacy_payload || jsonb_build_array(normalized_recipient_email);

  -- Migration 20260921140000 created receipts without the recipient hint in
  -- their fingerprint. A completed legacy receipt remains safe to replay: it
  -- can only return the already-created loan and cannot change its recipient.
  legacy_fingerprint := encode(extensions.digest(legacy_payload::text, 'sha256'), 'hex');
  select request_hash, response
  into existing_fingerprint, result
  from public.idempotency_keys
  where user_id = auth.uid()
    and command = 'create_loan'
    and key = idempotency_key_input;

  if found and existing_fingerprint = legacy_fingerprint then
    if result is null then raise exception 'IDEMPOTENCY_INCOMPLETE'; end if;
    if not private.is_loan_member((result->>'loan_id')::uuid) then
      raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.loan_invites invitation
      where invitation.loan_id = (result->>'loan_id')::uuid
        and invitation.token_hash = encode(extensions.digest(result->>'invite_token', 'sha256'), 'hex')
        and invitation.revoked_at is null
        and invitation.used_at is null
        and invitation.expires_at > now()
    ) then
      result := result || jsonb_build_object('invite_token', null);
    end if;
    return result;
  end if;

  result := private.begin_idempotent_command(
    'create_loan',
    idempotency_key_input,
    current_payload
  );
  if result is not null then
    if not private.is_loan_member((result->>'loan_id')::uuid) then
      raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.loan_invites invitation
      where invitation.loan_id = (result->>'loan_id')::uuid
        and invitation.token_hash = encode(extensions.digest(result->>'invite_token', 'sha256'), 'hex')
        and invitation.revoked_at is null
        and invitation.used_at is null
        and invitation.expires_at > now()
    ) then
      result := result || jsonb_build_object('invite_token', null);
    end if;
    return result;
  end if;

  if principal_minor_input <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if currency_input !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
  if due_date_input < loan_date_input then raise exception 'INVALID_DUE_DATE'; end if;

  -- Email is only a notification hint. Invalid, unknown and self addresses are
  -- handled identically so the RPC does not disclose whether an account exists.
  if normalized_recipient_email is not null
     and normalized_recipient_email ~ '^[^@]+@[^@]+\.[^@]+$' then
    select account.id
    into resolved_recipient_id
    from auth.users account
    where lower(account.email) = normalized_recipient_email
      and account.id is distinct from auth.uid()
    limit 1;
  end if;

  target_role_value := case
    when creator_role_input = 'LENDER' then 'BORROWER'::public.loan_role
    else 'LENDER'::public.loan_role
  end;

  insert into public.loans (
    principal_minor, currency, loan_date, due_date, purpose, note, status, created_by
  ) values (
    principal_minor_input, currency_input, loan_date_input, due_date_input,
    purpose_input, note_input, 'PENDING', auth.uid()
  ) returning id into loan_id;

  insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at)
  values (loan_id, auth.uid(), creator_role_input, 'ACCEPTED', now());

  insert into public.loan_members (loan_id, user_id, role, membership_status)
  values (loan_id, resolved_recipient_id, target_role_value, 'INVITED');

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.loan_invites (loan_id, target_role, token_hash, expires_at, created_by)
  values (
    loan_id,
    target_role_value,
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    now() + interval '14 days',
    auth.uid()
  );

  insert into public.loan_events (loan_id, event_type, actor_id, metadata)
  values (
    loan_id,
    'LOAN_CREATED',
    auth.uid(),
    jsonb_build_object('principal_minor', principal_minor_input, 'currency', currency_input)
  );
  insert into public.loan_events (loan_id, event_type, actor_id, metadata)
  values (
    loan_id,
    'INVITE_CREATED',
    auth.uid(),
    jsonb_build_object('target_role', target_role_value)
  );

  result := jsonb_build_object(
    'loan_id', loan_id,
    'invite_token', invite_token,
    'status', 'PENDING'
  );
  perform private.complete_idempotent_command('create_loan', idempotency_key_input, result);
  return result;
end;
$$;

revoke all on function public.create_loan(public.loan_role, bigint, text, date, date, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_loan(public.loan_role, bigint, text, date, date, text, text, uuid, text) to authenticated;

commit;
