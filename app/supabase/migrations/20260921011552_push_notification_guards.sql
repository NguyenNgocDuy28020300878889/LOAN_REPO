begin;
set local lock_timeout='5s';
alter table private.push_devices add constraint push_token_length check(length(expo_token)<=256);

create function private.guard_push_device() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,871));
  if new.enabled and (select count(*) from private.push_devices where user_id=new.user_id and enabled and id<>new.id)>=10 then
    raise exception 'PUSH_DEVICE_LIMIT';
  end if;
  return new;
end; $$;
create trigger push_device_limit before insert or update on private.push_devices
for each row execute function private.guard_push_device();

create function private.cancel_changed_due_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.due_date is distinct from old.due_date or new.status<>'ACTIVE' then
    update private.push_deliveries set status='cancelled',lease_id=null,lease_until=null
    where loan_id=new.id and due_date is not null and status in ('pending','sending');
  end if;
  return new;
end; $$;
create trigger changed_due_push after update of due_date,status on public.loans
for each row execute function private.cancel_changed_due_push();
revoke all on function private.guard_push_device(),private.cancel_changed_due_push() from public,anon,authenticated;
commit;
