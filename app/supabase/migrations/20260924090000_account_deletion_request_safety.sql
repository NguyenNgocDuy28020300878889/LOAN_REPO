begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.get_my_account_deletion_request()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(request_row)
  from public.account_deletion_requests request_row
  where request_row.user_id = auth.uid();
$$;

create or replace function public.request_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.account_deletion_requests;
  session_id_text text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  if session_id_text is null
     or session_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or not exists (
       select 1
       from auth.sessions auth_session
       where auth_session.id = session_id_text::uuid
         and auth_session.user_id = auth.uid()
         and auth_session.created_at >= statement_timestamp() - interval '15 minutes'
     ) then
    raise exception 'REAUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;

  insert into public.account_deletion_requests (user_id)
  values (auth.uid())
  on conflict (user_id) do update
    set requested_at = case
      when public.account_deletion_requests.status in ('COMPLETED', 'PROCESSING')
        then public.account_deletion_requests.requested_at
      else statement_timestamp()
    end,
    status = case
      when public.account_deletion_requests.status in ('COMPLETED', 'PROCESSING')
        then public.account_deletion_requests.status
      else 'PENDING'
    end,
    completed_at = case
      when public.account_deletion_requests.status = 'COMPLETED'
        then public.account_deletion_requests.completed_at
      else null
    end,
    failure_reason = null
  returning * into result;

  return result;
end;
$$;

revoke all on function public.get_my_account_deletion_request() from public, anon;
grant execute on function public.get_my_account_deletion_request() to authenticated;
revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

commit;
