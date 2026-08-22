-- Preserve shared financial history when an auth account is deleted.
-- Personal profile data cascades from auth.users; financial actor references become anonymous.

alter table public.loans alter column created_by drop not null;
alter table public.loan_invites alter column created_by drop not null;
alter table public.repayments alter column created_by drop not null;

-- The initial checks require a live confirmer/disputer. Replace only those
-- checks so a completed record may retain its timestamp after that user is
-- anonymised, while pending/non-matching state remains invalid.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.repayments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%confirmed_by%';
  if constraint_name is not null then
    execute format('alter table public.repayments drop constraint %I', constraint_name);
  end if;

  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.repayments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%disputed_by%';
  if constraint_name is not null then
    execute format('alter table public.repayments drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.repayments
  add constraint repayments_confirmed_audit_check check (
    (status = 'CONFIRMED' and confirmed_at is not null)
    or (status <> 'CONFIRMED' and confirmed_by is null and confirmed_at is null)
  ),
  add constraint repayments_disputed_audit_check check (
    (status = 'DISPUTED' and disputed_at is not null)
    or (status <> 'DISPUTED' and disputed_by is null and disputed_at is null)
  );

alter table public.loans
  drop constraint loans_created_by_fkey,
  add constraint loans_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.loan_invites
  drop constraint loan_invites_created_by_fkey,
  add constraint loan_invites_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.repayments
  drop constraint repayments_created_by_fkey,
  add constraint repayments_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.repayments
  drop constraint repayments_confirmed_by_fkey,
  add constraint repayments_confirmed_by_fkey
    foreign key (confirmed_by) references auth.users(id) on delete set null,
  drop constraint repayments_disputed_by_fkey,
  add constraint repayments_disputed_by_fkey
    foreign key (disputed_by) references auth.users(id) on delete set null;

alter table public.loan_events
  drop constraint loan_events_actor_id_fkey,
  add constraint loan_events_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;
