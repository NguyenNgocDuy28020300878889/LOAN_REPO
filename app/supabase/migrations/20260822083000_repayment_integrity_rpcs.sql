create or replace function public.submit_repayment(
  loan_id_input uuid, amount_minor_input bigint, payment_date_input date,
  method_input text, note_input text, idempotency_key_input uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; loan_row public.loans; repayment_id uuid; remaining bigint;
begin
  result := private.begin_idempotent_command('submit_repayment', idempotency_key_input); if result is not null then return result; end if;
  if not private.is_loan_member(loan_id_input) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  select * into loan_row from public.loans where id = loan_id_input for update;
  if loan_row.status <> 'ACTIVE' then raise exception 'LOAN_NOT_ACTIVE'; end if;
  if amount_minor_input <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select loan_row.principal_minor - coalesce(sum(amount_minor), 0) into remaining from public.repayments where loan_id = loan_row.id and status = 'CONFIRMED';
  if amount_minor_input > remaining then raise exception 'REPAYMENT_EXCEEDS_REMAINING'; end if;
  insert into public.repayments (loan_id, amount_minor, payment_date, method, note, status, created_by)
  values (loan_row.id, amount_minor_input, payment_date_input, method_input, note_input, 'PENDING', auth.uid()) returning id into repayment_id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id, metadata)
  values (loan_row.id, 'REPAYMENT_SUBMITTED', auth.uid(), 'repayment', repayment_id, jsonb_build_object('amount_minor', amount_minor_input));
  result := jsonb_build_object('repayment_id', repayment_id, 'status', 'PENDING');
  perform private.complete_idempotent_command('submit_repayment', idempotency_key_input, result); return result;
end; $$;

create or replace function public.confirm_repayment(repayment_id_input uuid, idempotency_key_input uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; repayment_row public.repayments; loan_row public.loans; remaining bigint;
begin
  result := private.begin_idempotent_command('confirm_repayment', idempotency_key_input); if result is not null then return result; end if;
  select * into repayment_row from public.repayments where id = repayment_id_input for update;
  if not found then raise exception 'REPAYMENT_NOT_FOUND'; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;
  if repayment_row.created_by = auth.uid() then raise exception 'CANNOT_CONFIRM_OWN_REPAYMENT' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  select * into loan_row from public.loans where id = repayment_row.loan_id for update;
  if loan_row.status <> 'ACTIVE' then raise exception 'LOAN_NOT_ACTIVE'; end if;
  select loan_row.principal_minor - coalesce(sum(amount_minor), 0) into remaining from public.repayments where loan_id = loan_row.id and status = 'CONFIRMED';
  if repayment_row.amount_minor > remaining then raise exception 'REPAYMENT_EXCEEDS_REMAINING'; end if;
  update public.repayments set status = 'CONFIRMED', confirmed_by = auth.uid(), confirmed_at = now() where id = repayment_row.id;
  if repayment_row.amount_minor = remaining then update public.loans set status = 'REPAID' where id = loan_row.id; end if;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id, metadata)
  values (loan_row.id, 'REPAYMENT_CONFIRMED', auth.uid(), 'repayment', repayment_row.id, jsonb_build_object('amount_minor', repayment_row.amount_minor));
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'CONFIRMED', 'loan_status', case when repayment_row.amount_minor = remaining then 'REPAID' else 'ACTIVE' end);
  perform private.complete_idempotent_command('confirm_repayment', idempotency_key_input, result); return result;
end; $$;

create or replace function public.dispute_repayment(repayment_id_input uuid, idempotency_key_input uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('dispute_repayment', idempotency_key_input); if result is not null then return result; end if;
  select * into repayment_row from public.repayments where id = repayment_id_input for update;
  if not found then raise exception 'REPAYMENT_NOT_FOUND'; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;
  if repayment_row.created_by = auth.uid() then raise exception 'CANNOT_DISPUTE_OWN_REPAYMENT' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  update public.repayments set status = 'DISPUTED', disputed_by = auth.uid() where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id) values (repayment_row.loan_id, 'REPAYMENT_DISPUTED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'DISPUTED'); perform private.complete_idempotent_command('dispute_repayment', idempotency_key_input, result); return result;
end; $$;

create or replace function public.cancel_repayment(repayment_id_input uuid, idempotency_key_input uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('cancel_repayment', idempotency_key_input); if result is not null then return result; end if;
  select * into repayment_row from public.repayments where id = repayment_id_input for update;
  if not found then raise exception 'REPAYMENT_NOT_FOUND'; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;
  if repayment_row.created_by <> auth.uid() then raise exception 'CANNOT_CANCEL_OTHER_REPAYMENT' using errcode = '42501'; end if;
  update public.repayments set status = 'CANCELLED' where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id) values (repayment_row.loan_id, 'REPAYMENT_CANCELLED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'CANCELLED'); perform private.complete_idempotent_command('cancel_repayment', idempotency_key_input, result); return result;
end; $$;

grant execute on function public.submit_repayment(uuid, bigint, date, text, text, uuid) to authenticated;
grant execute on function public.confirm_repayment(uuid, uuid) to authenticated;
grant execute on function public.dispute_repayment(uuid, uuid) to authenticated;
grant execute on function public.cancel_repayment(uuid, uuid) to authenticated;
