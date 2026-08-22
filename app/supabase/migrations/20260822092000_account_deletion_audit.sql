create table private.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  former_user_id uuid not null,
  requested_at timestamptz not null,
  processed_at timestamptz not null default now(),
  outcome text not null check (outcome in ('COMPLETED', 'FAILED')),
  failure_reason text
);
revoke all on private.account_deletion_audit from anon, authenticated;
