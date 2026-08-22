create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  command text not null check (command ~ '^[a-z_]+$'),
  key uuid not null,
  response jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, command, key)
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  completed_at timestamptz,
  failure_reason text
);

create index idempotency_keys_created_at_idx on public.idempotency_keys(created_at);

alter table public.idempotency_keys enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy "users read their deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid());

create or replace function public.ensure_my_profile(
  display_name_input text default null,
  locale_input text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  insert into public.profiles (id, display_name, locale)
  values (
    auth.uid(),
    coalesce(nullif(trim(display_name_input), ''), 'Loan user'),
    coalesce(nullif(trim(locale_input), ''), 'en')
  )
  on conflict (id) do update
    set display_name = coalesce(nullif(trim(display_name_input), ''), public.profiles.display_name),
        locale = coalesce(nullif(trim(locale_input), ''), public.profiles.locale)
  returning * into result;

  return result;
end;
$$;

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.account_deletion_requests;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  insert into public.account_deletion_requests (user_id)
  values (auth.uid())
  on conflict (user_id) do update
    set requested_at = case
      when public.account_deletion_requests.status in ('COMPLETED', 'PROCESSING')
        then public.account_deletion_requests.requested_at
      else now()
    end,
    status = case
      when public.account_deletion_requests.status = 'COMPLETED' then 'COMPLETED'
      else 'PENDING'
    end,
    failure_reason = null
  returning * into result;

  return result;
end;
$$;

revoke all on public.idempotency_keys, public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant execute on function public.ensure_my_profile(text, text) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
