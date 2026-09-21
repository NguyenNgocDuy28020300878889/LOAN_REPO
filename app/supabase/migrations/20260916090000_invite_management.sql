-- All invite decisions serialize on the loan before locking the invite.
create or replace function public.manage_loan_invite(loan_id_input uuid, action_input text, idempotency_key_input uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; loan_row public.loans; target public.loan_role; token text; revoked integer;
begin
  result := private.begin_idempotent_command('manage_loan_invite',idempotency_key_input,jsonb_build_array(loan_id_input,action_input));
  select * into loan_row from public.loans where id=loan_id_input for update;
  if not found or loan_row.created_by is distinct from auth.uid() or not private.is_loan_member(loan_id_input) then
    raise exception 'LOAN_ACCESS_DENIED' using errcode='42501';
  end if;
  if action_input is null or action_input not in ('rotate','revoke') then raise exception 'INVALID_INVITE_ACTION'; end if;
  if result is not null then
    if not exists(select 1 from public.loan_invites i where i.loan_id=loan_id_input and i.token_hash=encode(extensions.digest(result->>'invite_token','sha256'),'hex') and i.used_at is null and i.revoked_at is null and i.expires_at>now()) then
      result := result || jsonb_build_object('invite_token',null);
    end if;
    return result;
  end if;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;
  select role into target from public.loan_members where loan_id=loan_id_input and membership_status='INVITED' and user_id is null;
  if not found then raise exception 'INVITE_MEMBER_UNAVAILABLE'; end if;
  update public.loan_invites set revoked_at=now() where loan_id=loan_id_input and used_at is null and revoked_at is null;
  get diagnostics revoked=row_count;
  if revoked>0 then
    insert into public.loan_events(loan_id,event_type,actor_id,metadata)
    values(loan_id_input,'INVITE_REVOKED',auth.uid(),jsonb_build_object('reason',case when action_input='rotate' then 'REPLACED' else 'OWNER_REVOKED' end));
  end if;
  if action_input='rotate' then
    token := encode(extensions.gen_random_bytes(32),'hex');
    insert into public.loan_invites(loan_id,target_role,token_hash,expires_at,created_by)
    values(loan_id_input,target,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '14 days',auth.uid());
    insert into public.loan_events(loan_id,event_type,actor_id,metadata)
    values(loan_id_input,'INVITE_CREATED',auth.uid(),jsonb_build_object('target_role',target));
  end if;
  result := jsonb_build_object('loan_id',loan_id_input,'invite_token',token,'action',action_input);
  perform private.complete_idempotent_command('manage_loan_invite',idempotency_key_input,result);
  return result;
end; $$;
revoke execute on function public.manage_loan_invite(uuid,text,uuid) from public,anon;
grant execute on function public.manage_loan_invite(uuid,text,uuid) to authenticated;

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
  -- Loan before invite: same lock order as owner revocation/rotation.
  perform 1 from public.loans where id=invite_row.loan_id for update;
  select * into invite_row from public.loan_invites where id=invite_row.id for update;
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
  where token_hash = encode(extensions.digest(invite_token_input, 'sha256'), 'hex');
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  -- Loan before invite: same lock order as owner revocation/rotation.
  perform 1 from public.loans where id=invite_row.loan_id for update;
  select * into invite_row from public.loan_invites where id=invite_row.id for update;
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

