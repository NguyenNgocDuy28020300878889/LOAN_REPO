-- Invite notification hint: allow creator to specify recipient email for push notification
-- This does NOT change the capability-link model. Email is a notification hint only.
begin;
set local lock_timeout = '5s';

-- 1. Expand push_deliveries kind to include INVITE_RECEIVED
alter table private.push_deliveries drop constraint if exists push_deliveries_kind_check;
alter table private.push_deliveries add constraint push_deliveries_kind_check
  check (kind in ('LOAN_ACCEPTED','REPAYMENT_SUBMITTED','REPAYMENT_CONFIRMED','REPAYMENT_DISPUTED','DUE_TOMORROW','DUE_TODAY','INVITE_RECEIVED'));

-- 2. Update private.push_allowed to support invited members (when is_invite is true)
drop function if exists private.push_allowed(private.push_devices, uuid, boolean);
create or replace function private.push_allowed(
  device private.push_devices,
  loan_uuid uuid,
  reminder boolean,
  is_invite boolean default false
)
returns boolean language sql stable security definer set search_path = '' as $$
 select device.enabled
   and exists(select 1 from auth.sessions s where s.id=device.session_id and s.user_id=device.user_id and (s.not_after is null or s.not_after>now()))
   and exists(select 1 from public.loan_members m where m.loan_id=loan_uuid and m.user_id=device.user_id and (
     case when is_invite then m.membership_status='INVITED' else m.membership_status='ACCEPTED' end
   ))
   and not exists(select 1 from public.notification_preferences p where p.user_id=device.user_id and (not p.push_enabled or (reminder and not p.due_reminders_enabled)))
   and not exists(select 1 from public.account_deletion_requests r where r.user_id=device.user_id and r.status in ('PENDING','PROCESSING'));
$$;
revoke all on function private.push_allowed(private.push_devices, uuid, boolean, boolean) from public, anon, authenticated;

-- 3. Update private.push_delivery_valid to validate INVITE_RECEIVED correctly
create or replace function private.push_delivery_valid(job private.push_deliveries, clock_input timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
 select job.expires_at>clock_input and exists(
   select 1 from private.push_devices d join public.loans l on l.id=job.loan_id
   where d.id=job.device_id and d.user_id=job.user_id and d.binding_version=job.binding_version
     and private.push_allowed(d, l.id, job.due_date is not null, job.kind = 'INVITE_RECEIVED')
     and (
       case
         when job.kind = 'INVITE_RECEIVED' then l.status = 'PENDING'
         when job.due_date is not null then (
           l.status='ACTIVE' and l.due_date=job.due_date
           and (clock_input at time zone d.timezone)::date = job.due_date - case when job.kind='DUE_TOMORROW' then 1 else 0 end
           and (clock_input at time zone d.timezone)::time >= time '09:00'
           and l.principal_minor > coalesce((select sum(r.amount_minor) from public.repayments r where r.loan_id=l.id and r.status='CONFIRMED'),0)
         )
         else l.status in ('ACTIVE', 'PENDING', 'REPAID')
       end
     ));
$$;
revoke all on function private.push_delivery_valid(private.push_deliveries, timestamptz) from public, anon, authenticated;

-- 4. Replace enqueue_loan_push to also handle INVITE_CREATED
create or replace function private.enqueue_loan_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'INVITE_CREATED' then
    insert into private.push_deliveries(device_id,user_id,loan_id,event_id,binding_version,kind,dedupe_key,expires_at)
    select d.id, d.user_id, new.loan_id, new.id, d.binding_version, 'INVITE_RECEIVED',
           new.id::text||':'||d.id::text, now()+interval '24 hours'
    from public.loan_members m
    join private.push_devices d on d.user_id = m.user_id
    where m.loan_id = new.loan_id
      and m.membership_status = 'INVITED'
      and m.user_id is not null
      and m.user_id is distinct from new.actor_id
      and private.push_allowed(d, new.loan_id, false, true)
    on conflict(dedupe_key) do nothing;
    return new;
  end if;

  if new.event_type not in ('LOAN_ACCEPTED','REPAYMENT_SUBMITTED','REPAYMENT_CONFIRMED','REPAYMENT_DISPUTED') then return new; end if;
  insert into private.push_deliveries(device_id,user_id,loan_id,event_id,binding_version,kind,dedupe_key,expires_at)
  select d.id,d.user_id,new.loan_id,new.id,d.binding_version,new.event_type,new.id::text||':'||d.id::text,now()+interval '24 hours'
  from private.push_devices d where d.user_id is distinct from new.actor_id and private.push_allowed(d,new.loan_id,false,false)
  on conflict(dedupe_key) do nothing;
  return new;
end; $$;
revoke all on function private.enqueue_loan_push() from public, anon, authenticated;

-- 5. Expand create_loan to accept optional recipient_email_input
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

  -- Resolve recipient email to user_id (notification hint only, silent failure to prevent user enumeration)
  if recipient_email_input is not null and recipient_email_input ~ '^[^@]+@[^@]+\.[^@]+$' then
    select au.id into resolved_recipient_id
    from auth.users au
    where lower(au.email) = lower(trim(recipient_email_input))
      and au.id is distinct from auth.uid()
    limit 1;
  end if;

  target_role_value := case when creator_role_input = 'LENDER' then 'BORROWER' else 'LENDER' end;
  insert into public.loans (principal_minor, currency, loan_date, due_date, purpose, note, status, created_by)
  values (principal_minor_input, currency_input, loan_date_input, due_date_input, purpose_input, note_input, 'PENDING', auth.uid())
  returning id into loan_id;

  insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at)
  values (loan_id, auth.uid(), creator_role_input, 'ACCEPTED', now());
  -- Set user_id on the invited member if we resolved the recipient
  insert into public.loan_members (loan_id, user_id, role, membership_status)
  values (loan_id, resolved_recipient_id, target_role_value, 'INVITED');

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
revoke all on function public.create_loan(public.loan_role, bigint, text, date, date, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_loan(public.loan_role, bigint, text, date, date, text, text, uuid, text) to authenticated;

-- 6. Update accept_loan_invite & decline_loan_invite to allow designated invited member to also use token link
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
  where token_hash = encode(extensions.digest(invite_token_input, 'sha256'), 'hex');
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;

  perform 1 from public.loans where id=invite_row.loan_id for update;
  select * into invite_row from public.loan_invites where id=invite_row.id for update;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if invite_row.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;

  select * into loan_row from public.loans where id = invite_row.loan_id for update;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;

  -- Creator cannot accept their own invite, nor can already accepted members
  if loan_row.created_by = auth.uid() or exists (
    select 1 from public.loan_members where loan_id = loan_row.id and user_id = auth.uid() and membership_status = 'ACCEPTED'
  ) then
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
  where token_hash = encode(extensions.digest(invite_token_input, 'sha256'), 'hex');
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;

  perform 1 from public.loans where id=invite_row.loan_id for update;
  select * into invite_row from public.loan_invites where id=invite_row.id for update;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null or invite_row.revoked_at is not null then raise exception 'INVITE_UNAVAILABLE'; end if;

  if (select created_by from public.loans where id = invite_row.loan_id) = auth.uid() or exists (
    select 1 from public.loan_members where loan_id = invite_row.loan_id and user_id = auth.uid() and membership_status = 'ACCEPTED'
  ) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  update public.loans set status = 'DECLINED' where id = invite_row.loan_id and status = 'PENDING';
  if not found then raise exception 'LOAN_NOT_PENDING'; end if;

  update public.loan_invites set revoked_at = now() where id = invite_row.id;
  update public.loan_members set membership_status = 'DECLINED'
  where loan_id = invite_row.loan_id and role = invite_row.target_role and membership_status = 'INVITED';

  insert into public.loan_events (loan_id, event_type, actor_id) values (invite_row.loan_id, 'LOAN_DECLINED', auth.uid());

  result := jsonb_build_object('loan_id', invite_row.loan_id, 'status', 'DECLINED');
  perform private.complete_idempotent_command('decline_loan_invite', idempotency_key_input, result);
  return result;
end;
$$;

-- 7. RPC: get pending invites list for the current user
create or replace function public.get_my_pending_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;

  return coalesce((
    select jsonb_agg(item order by created_at desc)
    from (
      select l.created_at,
        jsonb_build_object(
          'loan_id', l.id,
          'principal_minor', l.principal_minor,
          'currency', l.currency,
          'loan_date', l.loan_date,
          'due_date', l.due_date,
          'purpose', l.purpose,
          'note', l.note,
          'my_role', mine.role,
          'creator_name', coalesce(p.display_name, 'Loan user'),
          'invited_at', mine.invited_at
        ) as item
      from public.loans l
      join public.loan_members mine on mine.loan_id = l.id
      left join public.profiles p on p.id = l.created_by
      where mine.user_id = auth.uid()
        and mine.membership_status = 'INVITED'
        and l.status = 'PENDING'
    ) summaries
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_my_pending_invites() from public, anon, authenticated;
grant execute on function public.get_my_pending_invites() to authenticated;

-- 8. RPC: get single pending invite detail for the current user
create or replace function public.get_pending_invite_detail(loan_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;

  select jsonb_build_object(
    'loan_id', l.id,
    'principal_minor', l.principal_minor,
    'currency', l.currency,
    'loan_date', l.loan_date,
    'due_date', l.due_date,
    'purpose', l.purpose,
    'note', l.note,
    'my_role', mine.role,
    'creator_name', coalesce(p.display_name, 'Loan user'),
    'invited_at', mine.invited_at
  ) into item
  from public.loans l
  join public.loan_members mine on mine.loan_id = l.id
  left join public.profiles p on p.id = l.created_by
  where l.id = loan_id_input
    and mine.user_id = auth.uid()
    and mine.membership_status = 'INVITED'
    and l.status = 'PENDING';

  if item is null then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  return item;
end;
$$;
revoke all on function public.get_pending_invite_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_pending_invite_detail(uuid) to authenticated;

-- 9. RPC: respond to invite by loan_id (for designated recipients)
create or replace function public.respond_to_invite(
  loan_id_input uuid,
  decision_input text,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  loan_row public.loans;
  member_row public.loan_members;
begin
  if decision_input not in ('accept', 'decline') then raise exception 'INVALID_DECISION'; end if;

  result := private.begin_idempotent_command('respond_to_invite', idempotency_key_input, jsonb_build_array(loan_id_input, decision_input));
  if result is not null then
    if not exists (select 1 from public.loan_members where loan_id = (result->>'loan_id')::uuid and user_id = auth.uid()) then
      raise exception 'LOAN_ACCESS_DENIED' using errcode='42501';
    end if;
    return result;
  end if;

  -- Verify the current user is the designated recipient with INVITED status
  select * into member_row from public.loan_members
  where loan_id = loan_id_input and user_id = auth.uid() and membership_status = 'INVITED'
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;

  select * into loan_row from public.loans where id = loan_id_input for update;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;

  if decision_input = 'accept' then
    update public.loan_members
    set membership_status = 'ACCEPTED', joined_at = now()
    where id = member_row.id;
    update public.loans set status = 'ACTIVE' where id = loan_id_input;
    -- Mark any outstanding invite tokens as used
    update public.loan_invites set used_at = now()
    where loan_id = loan_id_input and used_at is null and revoked_at is null;
    insert into public.loan_events (loan_id, event_type, actor_id)
    values (loan_id_input, 'LOAN_ACCEPTED', auth.uid());
    result := jsonb_build_object('loan_id', loan_id_input, 'status', 'ACTIVE');
  else
    update public.loan_members
    set membership_status = 'DECLINED'
    where id = member_row.id;
    update public.loans set status = 'DECLINED' where id = loan_id_input;
    update public.loan_invites set revoked_at = now()
    where loan_id = loan_id_input and used_at is null and revoked_at is null;
    insert into public.loan_events (loan_id, event_type, actor_id)
    values (loan_id_input, 'LOAN_DECLINED', auth.uid());
    result := jsonb_build_object('loan_id', loan_id_input, 'status', 'DECLINED');
  end if;

  perform private.complete_idempotent_command('respond_to_invite', idempotency_key_input, result);
  return result;
end;
$$;
revoke all on function public.respond_to_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.respond_to_invite(uuid, text, uuid) to authenticated;

commit;
