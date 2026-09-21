begin;
set local lock_timeout='5s';
create or replace function public.enqueue_due_push(clock_input timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare added integer;
begin
  insert into private.push_deliveries(device_id,user_id,loan_id,binding_version,kind,due_date,dedupe_key,expires_at)
  select d.id,d.user_id,l.id,d.binding_version,
    case when l.due_date=(clock_input at time zone d.timezone)::date then 'DUE_TODAY' else 'DUE_TOMORROW' end,
    l.due_date,'due:'||l.id::text||':'||d.user_id::text||':'||d.id::text||':'||l.due_date::text||':'||(clock_input at time zone d.timezone)::date::text,
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

create or replace function public.finish_push_work(id_input uuid, lease_input uuid, outcome_input text, ticket_input text default null, error_input text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare job private.push_deliveries;
begin
  select * into job from private.push_deliveries where id=id_input and lease_id=lease_input and status in ('sending','checking') and lease_until>now() for update;
  if not found then return; end if;
  if outcome_input is null or outcome_input not in ('accepted','retry','failed','delivered','receipt_wait') then raise exception 'INVALID_OUTCOME'; end if;
  if (job.status='sending' and outcome_input in ('delivered','receipt_wait')) or
     (job.status='checking' and outcome_input='accepted') then raise exception 'INVALID_TRANSITION'; end if;
  if outcome_input='accepted' and (ticket_input is null or length(ticket_input)>200) then raise exception 'INVALID_TICKET'; end if;
  update private.push_deliveries set
    status=case outcome_input when 'accepted' then 'ticketed' when 'delivered' then 'delivered'
      when 'receipt_wait' then 'ticketed' when 'retry' then case when attempts>=5 then 'failed' else 'pending' end else 'failed' end,
    available_at=now()+case when outcome_input='accepted' then interval '15 minutes' when outcome_input='receipt_wait' then interval '5 minutes' else interval '1 minute'*power(2,job.attempts) end,
    ticket_id=case when outcome_input='retry' then null else coalesce(ticket_input,ticket_id) end,
    ticket_at=case when outcome_input='retry' then null when outcome_input='accepted' then now() else ticket_at end,
    last_error=left(error_input,100),lease_id=null,lease_until=null where id=job.id;
  if error_input='DeviceNotRegistered' then
    update private.push_devices set enabled=false,binding_version=binding_version+1
    where id=job.device_id and binding_version=job.binding_version;
  end if;
end; $$;


commit;
