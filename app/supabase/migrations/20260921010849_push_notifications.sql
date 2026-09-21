begin;
set local lock_timeout = '5s';

-- Tokens and delivery records are never exposed through PostgREST tables.
create table private.push_devices (
  id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  expo_token text not null unique check (expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  platform text not null check (platform in ('android','ios')),
  timezone text not null,
  locale text not null check (locale in ('vi','en')),
  enabled boolean not null default true,
  binding_version bigint not null default 1 check (binding_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_devices_user_idx on private.push_devices(user_id);
create index push_devices_session_idx on private.push_devices(session_id);
create trigger push_devices_updated before update on private.push_devices
  for each row execute function public.set_updated_at();

create table private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references private.push_devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  event_id uuid references public.loan_events(id) on delete cascade,
  binding_version bigint not null,
  kind text not null check (kind in ('LOAN_ACCEPTED','REPAYMENT_SUBMITTED','REPAYMENT_CONFIRMED','REPAYMENT_DISPUTED','DUE_TOMORROW','DUE_TODAY')),
  due_date date,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending','sending','ticketed','checking','delivered','failed','cancelled','unknown')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  expires_at timestamptz not null,
  lease_id uuid,
  lease_until timestamptz,
  ticket_id text,
  ticket_at timestamptz,
  last_error text check (length(last_error) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind in ('DUE_TOMORROW','DUE_TODAY')) = (due_date is not null)),
  check ((kind in ('DUE_TOMORROW','DUE_TODAY')) = (event_id is null))
);
create index push_deliveries_device_idx on private.push_deliveries(device_id);
create index push_deliveries_user_idx on private.push_deliveries(user_id);
create index push_deliveries_loan_idx on private.push_deliveries(loan_id);
create index push_deliveries_event_idx on private.push_deliveries(event_id);
create index push_deliveries_work_idx on private.push_deliveries(status,available_at);
create trigger push_deliveries_updated before update on private.push_deliveries
  for each row execute function public.set_updated_at();
alter table private.push_devices enable row level security;
alter table private.push_deliveries enable row level security;
revoke all on private.push_devices, private.push_deliveries from public, anon, authenticated;

create function public.register_push_device(device_id_input uuid, secret_input text, token_input text,
  platform_input text, timezone_input text, locale_input text)
returns void language plpgsql security definer set search_path = '' as $$
declare session_uuid uuid := (auth.jwt()->>'session_id')::uuid;
begin
  if auth.uid() is null or not exists(select 1 from auth.sessions where id=session_uuid and user_id=auth.uid()
    and (not_after is null or not_after > now())) then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';
  end if;
  if secret_input is null or secret_input !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_DEVICE_SECRET'; end if;
  if not exists(select 1 from pg_timezone_names where name=timezone_input) then raise exception 'INVALID_TIMEZONE'; end if;
  if exists(select 1 from public.account_deletion_requests where user_id=auth.uid() and status in ('PENDING','PROCESSING')) then
    raise exception 'ACCOUNT_DELETION_PENDING';
  end if;
  insert into private.push_devices(id,secret_hash,user_id,session_id,expo_token,platform,timezone,locale)
  values(device_id_input,encode(extensions.digest(secret_input,'sha256'),'hex'),auth.uid(),session_uuid,token_input,platform_input,timezone_input,locale_input)
  on conflict(id) do update set user_id=excluded.user_id, session_id=excluded.session_id,
    expo_token=excluded.expo_token, platform=excluded.platform, timezone=excluded.timezone,
    locale=excluded.locale, enabled=true,
    binding_version=private.push_devices.binding_version + case when
      (private.push_devices.user_id,private.push_devices.session_id,private.push_devices.expo_token,private.push_devices.enabled)
      is distinct from (excluded.user_id,excluded.session_id,excluded.expo_token,true) then 1 else 0 end
  where private.push_devices.secret_hash=excluded.secret_hash;
  if not found then raise exception 'DEVICE_OWNERSHIP_REQUIRED' using errcode='42501'; end if;
end; $$;

create function public.unregister_push_device(device_id_input uuid, secret_input text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  update private.push_devices set enabled=false, binding_version=binding_version+1
  where id=device_id_input and user_id=auth.uid()
    and secret_hash=encode(extensions.digest(secret_input,'sha256'),'hex');
end; $$;

create function private.push_allowed(device private.push_devices, loan_uuid uuid, reminder boolean)
returns boolean language sql stable security definer set search_path = '' as $$
 select device.enabled
   and exists(select 1 from auth.sessions s where s.id=device.session_id and s.user_id=device.user_id and (s.not_after is null or s.not_after>now()))
   and exists(select 1 from public.loan_members m where m.loan_id=loan_uuid and m.user_id=device.user_id and m.membership_status='ACCEPTED')
   and not exists(select 1 from public.notification_preferences p where p.user_id=device.user_id and (not p.push_enabled or (reminder and not p.due_reminders_enabled)))
   and not exists(select 1 from public.account_deletion_requests r where r.user_id=device.user_id and r.status in ('PENDING','PROCESSING'));
$$;

create function private.enqueue_loan_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type not in ('LOAN_ACCEPTED','REPAYMENT_SUBMITTED','REPAYMENT_CONFIRMED','REPAYMENT_DISPUTED') then return new; end if;
  insert into private.push_deliveries(device_id,user_id,loan_id,event_id,binding_version,kind,dedupe_key,expires_at)
  select d.id,d.user_id,new.loan_id,new.id,d.binding_version,new.event_type,new.id::text||':'||d.id::text,now()+interval '24 hours'
  from private.push_devices d where d.user_id is distinct from new.actor_id and private.push_allowed(d,new.loan_id,false)
  on conflict(dedupe_key) do nothing;
  return new;
end; $$;
create trigger loan_event_push after insert on public.loan_events for each row execute function private.enqueue_loan_push();

create function public.enqueue_due_push(clock_input timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare added integer;
begin
  insert into private.push_deliveries(device_id,user_id,loan_id,binding_version,kind,due_date,dedupe_key,expires_at)
  select d.id,d.user_id,l.id,d.binding_version,
    case when l.due_date=(clock_input at time zone d.timezone)::date then 'DUE_TODAY' else 'DUE_TOMORROW' end,
    l.due_date,'due:'||l.id::text||':'||d.id::text||':'||l.due_date::text||':'||(clock_input at time zone d.timezone)::date::text,
    (((clock_input at time zone d.timezone)::date+1)::timestamp at time zone d.timezone)
  from private.push_devices d join public.loan_members m on m.user_id=d.user_id and m.membership_status='ACCEPTED'
  join public.loans l on l.id=m.loan_id
  where private.push_allowed(d,l.id,true) and l.status='ACTIVE'
    and (clock_input at time zone d.timezone)::time >= time '09:00'
    and l.due_date in ((clock_input at time zone d.timezone)::date, (clock_input at time zone d.timezone)::date+1)
    and l.principal_minor > coalesce((select sum(r.amount_minor) from public.repayments r where r.loan_id=l.id and r.status='CONFIRMED'),0)
  on conflict(dedupe_key) do nothing;
  get diagnostics added=row_count;
  return added;
end; $$;

create function private.push_delivery_valid(job private.push_deliveries, clock_input timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
 select job.expires_at>clock_input and exists(
   select 1 from private.push_devices d join public.loans l on l.id=job.loan_id
   where d.id=job.device_id and d.user_id=job.user_id and d.binding_version=job.binding_version
     and private.push_allowed(d,l.id,job.due_date is not null)
     and (job.due_date is null or (
       l.status='ACTIVE' and l.due_date=job.due_date
       and (clock_input at time zone d.timezone)::date = job.due_date - case when job.kind='DUE_TOMORROW' then 1 else 0 end
       and (clock_input at time zone d.timezone)::time >= time '09:00'
       and l.principal_minor > coalesce((select sum(r.amount_minor) from public.repayments r where r.loan_id=l.id and r.status='CONFIRMED'),0)
     )));
$$;

create function public.claim_push_work(receipts_input boolean default false, limit_input integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  -- Recover abandoned leases. A send timeout can be retried: delivery is at-least-once.
  update private.push_deliveries set status=case when status='checking' then 'ticketed' when attempts>=5 then 'failed' else 'pending' end,
    lease_id=null,lease_until=null where status in ('sending','checking') and lease_until<now();
  update private.push_deliveries j set status='cancelled' where status='pending' and not private.push_delivery_valid(j,now());
  update private.push_deliveries set status='unknown',last_error='ReceiptExpired' where status='ticketed' and ticket_at<now()-interval '24 hours';
  with picked as (
    select id from private.push_deliveries where status=case when receipts_input then 'ticketed' else 'pending' end
      and available_at<=now() order by available_at,id for update skip locked limit greatest(1,least(limit_input,50))
  ), claimed as (
    update private.push_deliveries j set status=case when receipts_input then 'checking' else 'sending' end,
      lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+case when receipts_input then 0 else 1 end
    from picked where j.id=picked.id returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease_id',j.lease_id,'token',d.expo_token,
      'kind',j.kind,'loan_id',j.loan_id,'user_id',j.user_id,'locale',d.locale,'ticket_id',j.ticket_id)), '[]'::jsonb)
    into result from claimed j join private.push_devices d on d.id=j.device_id;
  return result;
end; $$;

create function public.authorize_push_send(id_input uuid, lease_input uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare job private.push_deliveries;
begin
  select * into job from private.push_deliveries where id=id_input and lease_id=lease_input and status='sending' and lease_until>now() for update;
  if not found then return false; end if;
  if not private.push_delivery_valid(job,now()) then
    update private.push_deliveries set status='cancelled',lease_id=null,lease_until=null where id=job.id;
    return false;
  end if;
  return true;
end; $$;

create function public.finish_push_work(id_input uuid, lease_input uuid, outcome_input text, ticket_input text default null, error_input text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare job private.push_deliveries;
begin
  select * into job from private.push_deliveries where id=id_input and lease_id=lease_input and status in ('sending','checking') and lease_until>now() for update;
  if not found then return; end if;
  if outcome_input not in ('accepted','retry','failed','delivered','receipt_wait') then raise exception 'INVALID_OUTCOME'; end if;
  if (job.status='sending' and outcome_input in ('delivered','receipt_wait')) or
     (job.status='checking' and outcome_input in ('accepted','retry')) then raise exception 'INVALID_TRANSITION'; end if;
  if outcome_input='accepted' and (ticket_input is null or length(ticket_input)>200) then raise exception 'INVALID_TICKET'; end if;
  update private.push_deliveries set
    status=case outcome_input when 'accepted' then 'ticketed' when 'delivered' then 'delivered'
      when 'receipt_wait' then 'ticketed' when 'retry' then case when attempts>=5 then 'failed' else 'pending' end else 'failed' end,
    available_at=now()+case when outcome_input='accepted' then interval '15 minutes' when outcome_input='receipt_wait' then interval '5 minutes' else interval '1 minute'*power(2,job.attempts) end,
    ticket_id=coalesce(ticket_input,ticket_id),ticket_at=case when outcome_input='accepted' then now() else ticket_at end,
    last_error=left(error_input,100),lease_id=null,lease_until=null where id=job.id;
  if error_input='DeviceNotRegistered' then
    update private.push_devices set enabled=false,binding_version=binding_version+1
    where id=job.device_id and binding_version=job.binding_version;
  end if;
end; $$;

-- Switching a preference off permanently cancels queued work, even if switched back on.
create function private.cancel_disabled_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.push_deliveries set status='cancelled',lease_id=null,lease_until=null
 where user_id=new.user_id and status in ('pending','sending') and (not new.push_enabled or (due_date is not null and not new.due_reminders_enabled));
 return new;
end; $$;
create trigger notification_preferences_cancel after insert or update on public.notification_preferences
for each row execute function private.cancel_disabled_push();

revoke all on function public.register_push_device(uuid,text,text,text,text,text), public.unregister_push_device(uuid,text) from public,anon,authenticated;
grant execute on function public.register_push_device(uuid,text,text,text,text,text), public.unregister_push_device(uuid,text) to authenticated;
revoke all on function public.enqueue_due_push(timestamptz),public.claim_push_work(boolean,integer),public.authorize_push_send(uuid,uuid),public.finish_push_work(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_due_push(timestamptz),public.claim_push_work(boolean,integer),public.authorize_push_send(uuid,uuid),public.finish_push_work(uuid,uuid,text,text,text) to service_role;
revoke all on function private.push_allowed(private.push_devices,uuid,boolean),private.push_delivery_valid(private.push_deliveries,timestamptz),private.enqueue_loan_push(),private.cancel_disabled_push() from public,anon,authenticated;
commit;
