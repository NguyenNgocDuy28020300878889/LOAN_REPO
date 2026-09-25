begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.purge_account_deletion_audit(retention_days_input integer default 180)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if retention_days_input < 30 or retention_days_input > 365 then
    raise exception 'INVALID_AUDIT_RETENTION' using errcode = '22023';
  end if;

  delete from private.account_deletion_audit
  where outcome in ('COMPLETED', 'FAILED')
    and processed_at < statement_timestamp() - pg_catalog.make_interval(days => retention_days_input);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_account_deletion_audit(integer)
  from public, anon, authenticated;
grant execute on function public.purge_account_deletion_audit(integer) to service_role;

commit;
