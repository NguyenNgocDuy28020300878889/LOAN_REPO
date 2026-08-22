create extension if not exists pgcrypto;
create schema if not exists private;

create type public.loan_status as enum (
  'DRAFT', 'PENDING', 'ACTIVE', 'REPAID', 'CLOSED', 'DECLINED', 'CANCELLED'
);
create type public.loan_role as enum ('LENDER', 'BORROWER');
create type public.membership_status as enum ('INVITED', 'ACCEPTED', 'DECLINED');
create type public.repayment_status as enum ('PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  principal_minor bigint not null check (principal_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  loan_date date not null,
  due_date date not null check (due_date >= loan_date),
  purpose text check (char_length(purpose) <= 280),
  note text check (char_length(note) <= 2000),
  status public.loan_status not null default 'DRAFT',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.loan_members (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  role public.loan_role not null,
  membership_status public.membership_status not null default 'INVITED',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (loan_id, role),
  unique (loan_id, user_id),
  check ((membership_status = 'ACCEPTED') = (joined_at is not null))
);

create table public.loan_invites (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  target_role public.loan_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  payment_date date not null,
  method text check (char_length(method) <= 80),
  note text check (char_length(note) <= 1000),
  status public.repayment_status not null default 'PENDING',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  disputed_by uuid references auth.users(id),
  disputed_at timestamptz,
  check ((status = 'CONFIRMED') = (confirmed_by is not null and confirmed_at is not null)),
  check ((status = 'DISPUTED') = (disputed_by is not null and disputed_at is not null))
);

create table public.loan_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  event_type text not null check (event_type ~ '^[A-Z_]+$'),
  actor_id uuid references auth.users(id),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index loan_members_user_id_idx on public.loan_members(user_id);
create index loan_invites_loan_id_idx on public.loan_invites(loan_id);
create index repayments_loan_id_created_at_idx on public.repayments(loan_id, created_at desc);
create index loan_events_loan_id_created_at_idx on public.loan_events(loan_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger loans_set_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, locale)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Loan user'),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function private.is_loan_member(target_loan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.loan_members
    where loan_id = target_loan_id
      and user_id = auth.uid()
      and membership_status = 'ACCEPTED'
  );
$$;

create or replace function private.shares_loan_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_user_id or exists (
    select 1
    from public.loan_members mine
    join public.loan_members theirs on theirs.loan_id = mine.loan_id
    where mine.user_id = auth.uid()
      and mine.membership_status = 'ACCEPTED'
      and theirs.user_id = target_user_id
      and theirs.membership_status = 'ACCEPTED'
  );
$$;

grant execute on function private.is_loan_member(uuid) to authenticated;
grant execute on function private.shares_loan_with(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.loans enable row level security;
alter table public.loan_members enable row level security;
alter table public.loan_invites enable row level security;
alter table public.repayments enable row level security;
alter table public.loan_events enable row level security;

create policy "profiles are visible to shared participants"
  on public.profiles for select to authenticated
  using (private.shares_loan_with(id));
create policy "users update their profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "participants read loans"
  on public.loans for select to authenticated
  using (private.is_loan_member(id));
create policy "participants read memberships"
  on public.loan_members for select to authenticated
  using (private.is_loan_member(loan_id));
create policy "participants read repayments"
  on public.repayments for select to authenticated
  using (private.is_loan_member(loan_id));
create policy "participants read audit events"
  on public.loan_events for select to authenticated
  using (private.is_loan_member(loan_id));

revoke all on public.loans, public.loan_members, public.loan_invites,
  public.repayments, public.loan_events from anon, authenticated;
grant select on public.profiles, public.loans, public.loan_members,
  public.repayments, public.loan_events to authenticated;
