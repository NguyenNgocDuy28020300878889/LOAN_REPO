begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- A queued notification is valid only while the recipient can still act on
-- the invitation. This prevents expired or revoked links from producing a
-- stale push.
create or replace function private.push_delivery_valid(
  job private.push_deliveries,
  clock_input timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select job.expires_at > clock_input and exists (
    select 1
    from private.push_devices device
    join public.loans loan on loan.id = job.loan_id
    where device.id = job.device_id
      and device.user_id = job.user_id
      and device.binding_version = job.binding_version
      and private.push_allowed(
        device,
        loan.id,
        job.due_date is not null,
        job.kind = 'INVITE_RECEIVED'
      )
      and (
        case
          when job.kind = 'INVITE_RECEIVED' then
            loan.status = 'PENDING'
            and exists (
              select 1
              from public.loan_invites invitation
              where invitation.loan_id = loan.id
                and invitation.used_at is null
                and invitation.revoked_at is null
                and invitation.expires_at > clock_input
            )
          when job.due_date is not null then (
            loan.status = 'ACTIVE'
            and loan.due_date = job.due_date
            and (clock_input at time zone device.timezone)::date =
              job.due_date - case when job.kind = 'DUE_TOMORROW' then 1 else 0 end
            and (clock_input at time zone device.timezone)::time >= time '09:00'
            and loan.principal_minor > coalesce((
              select sum(repayment.amount_minor)
              from public.repayments repayment
              where repayment.loan_id = loan.id and repayment.status = 'CONFIRMED'
            ), 0)
          )
          else loan.status in ('ACTIVE', 'PENDING', 'REPAID')
        end
      )
  );
$$;

revoke all on function private.push_delivery_valid(private.push_deliveries, timestamptz)
from public, anon, authenticated;

-- Owners must be able to revoke or replace a link even when the invited
-- membership was bound to a known account by recipient email.
create or replace function public.manage_loan_invite(
  loan_id_input uuid,
  action_input text,
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
  target public.loan_role;
  token text;
  revoked integer;
begin
  result := private.begin_idempotent_command(
    'manage_loan_invite',
    idempotency_key_input,
    jsonb_build_array(loan_id_input, action_input)
  );

  select * into loan_row
  from public.loans
  where id = loan_id_input
  for update;

  if not found
     or loan_row.created_by is distinct from auth.uid()
     or not private.is_loan_member(loan_id_input) then
    raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
  end if;
  if action_input is null or action_input not in ('rotate', 'revoke') then
    raise exception 'INVALID_INVITE_ACTION';
  end if;

  if result is not null then
    if not exists (
      select 1
      from public.loan_invites invitation
      where invitation.loan_id = loan_id_input
        and invitation.token_hash = encode(
          extensions.digest(result->>'invite_token', 'sha256'),
          'hex'
        )
        and invitation.used_at is null
        and invitation.revoked_at is null
        and invitation.expires_at > now()
    ) then
      result := result || jsonb_build_object('invite_token', null);
    end if;
    return result;
  end if;

  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;

  select member.role into target
  from public.loan_members member
  where member.loan_id = loan_id_input
    and member.membership_status = 'INVITED';
  if not found then raise exception 'INVITE_MEMBER_UNAVAILABLE'; end if;

  update public.loan_invites
  set revoked_at = now()
  where loan_id = loan_id_input
    and used_at is null
    and revoked_at is null;
  get diagnostics revoked = row_count;

  update private.push_deliveries
  set status = 'cancelled',
      lease_id = null,
      lease_until = null
  where loan_id = loan_id_input
    and kind = 'INVITE_RECEIVED'
    and status in ('pending', 'sending');

  if revoked > 0 then
    insert into public.loan_events (loan_id, event_type, actor_id, metadata)
    values (
      loan_id_input,
      'INVITE_REVOKED',
      auth.uid(),
      jsonb_build_object(
        'reason',
        case when action_input = 'rotate' then 'REPLACED' else 'OWNER_REVOKED' end
      )
    );
  end if;

  if action_input = 'rotate' then
    token := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.loan_invites (loan_id, target_role, token_hash, expires_at, created_by)
    values (
      loan_id_input,
      target,
      encode(extensions.digest(token, 'sha256'), 'hex'),
      now() + interval '14 days',
      auth.uid()
    );
    insert into public.loan_events (loan_id, event_type, actor_id, metadata)
    values (
      loan_id_input,
      'INVITE_CREATED',
      auth.uid(),
      jsonb_build_object('target_role', target)
    );
  end if;

  result := jsonb_build_object(
    'loan_id', loan_id_input,
    'invite_token', token,
    'action', action_input
  );
  perform private.complete_idempotent_command(
    'manage_loan_invite',
    idempotency_key_input,
    result
  );
  return result;
end;
$$;

create or replace function public.get_my_pending_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(item order by created_at desc)
    from (
      select loan.created_at,
        jsonb_build_object(
          'loan_id', loan.id,
          'principal_minor', loan.principal_minor,
          'currency', loan.currency,
          'loan_date', loan.loan_date,
          'due_date', loan.due_date,
          'purpose', loan.purpose,
          'note', loan.note,
          'my_role', mine.role,
          'creator_name', coalesce(profile.display_name, 'Loan user'),
          'invited_at', mine.invited_at
        ) as item
      from public.loans loan
      join public.loan_members mine on mine.loan_id = loan.id
      left join public.profiles profile on profile.id = loan.created_by
      where mine.user_id = auth.uid()
        and mine.membership_status = 'INVITED'
        and loan.status = 'PENDING'
        and exists (
          select 1
          from public.loan_invites invitation
          where invitation.loan_id = loan.id
            and invitation.used_at is null
            and invitation.revoked_at is null
            and invitation.expires_at > now()
        )
    ) summaries
  ), '[]'::jsonb);
end;
$$;

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
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'loan_id', loan.id,
    'principal_minor', loan.principal_minor,
    'currency', loan.currency,
    'loan_date', loan.loan_date,
    'due_date', loan.due_date,
    'purpose', loan.purpose,
    'note', loan.note,
    'my_role', mine.role,
    'creator_name', coalesce(profile.display_name, 'Loan user'),
    'invited_at', mine.invited_at
  ) into item
  from public.loans loan
  join public.loan_members mine on mine.loan_id = loan.id
  left join public.profiles profile on profile.id = loan.created_by
  where loan.id = loan_id_input
    and mine.user_id = auth.uid()
    and mine.membership_status = 'INVITED'
    and loan.status = 'PENDING'
    and exists (
      select 1
      from public.loan_invites invitation
      where invitation.loan_id = loan.id
        and invitation.used_at is null
        and invitation.revoked_at is null
        and invitation.expires_at > now()
    );

  if item is null then raise exception 'INVITE_NOT_FOUND' using errcode = 'P0002'; end if;
  return item;
end;
$$;

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

  result := private.begin_idempotent_command(
    'respond_to_invite',
    idempotency_key_input,
    jsonb_build_array(loan_id_input, decision_input)
  );
  if result is not null then
    if not exists (
      select 1 from public.loan_members
      where loan_id = (result->>'loan_id')::uuid and user_id = auth.uid()
    ) then
      raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
    end if;
    return result;
  end if;

  -- Keep the same loan-before-invite lock order used by link rotation.
  select * into loan_row
  from public.loans
  where id = loan_id_input
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;

  select * into member_row
  from public.loan_members
  where loan_id = loan_id_input
    and user_id = auth.uid()
    and membership_status = 'INVITED'
  for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;

  perform 1
  from public.loan_invites
  where loan_id = loan_id_input
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    if exists (
      select 1 from public.loan_invites
      where loan_id = loan_id_input
        and used_at is null
        and revoked_at is null
        and expires_at <= now()
    ) then
      raise exception 'INVITE_EXPIRED';
    end if;
    raise exception 'INVITE_UNAVAILABLE';
  end if;

  if decision_input = 'accept' then
    update public.loan_members
    set membership_status = 'ACCEPTED', joined_at = now()
    where id = member_row.id;
    update public.loans set status = 'ACTIVE' where id = loan_id_input;
    update public.loan_invites
    set used_at = now()
    where loan_id = loan_id_input and used_at is null and revoked_at is null;
    insert into public.loan_events (loan_id, event_type, actor_id)
    values (loan_id_input, 'LOAN_ACCEPTED', auth.uid());
    result := jsonb_build_object('loan_id', loan_id_input, 'status', 'ACTIVE');
  else
    update public.loan_members
    set membership_status = 'DECLINED'
    where id = member_row.id;
    update public.loans set status = 'DECLINED' where id = loan_id_input;
    update public.loan_invites
    set revoked_at = now()
    where loan_id = loan_id_input and used_at is null and revoked_at is null;
    insert into public.loan_events (loan_id, event_type, actor_id)
    values (loan_id_input, 'LOAN_DECLINED', auth.uid());
    result := jsonb_build_object('loan_id', loan_id_input, 'status', 'DECLINED');
  end if;

  perform private.complete_idempotent_command(
    'respond_to_invite',
    idempotency_key_input,
    result
  );
  return result;
end;
$$;

revoke all on function public.manage_loan_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.manage_loan_invite(uuid, text, uuid) to authenticated;
revoke all on function public.get_my_pending_invites() from public, anon, authenticated;
grant execute on function public.get_my_pending_invites() to authenticated;
revoke all on function public.get_pending_invite_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_pending_invite_detail(uuid) to authenticated;
revoke all on function public.respond_to_invite(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.respond_to_invite(uuid, text, uuid) to authenticated;

commit;
