-- Fixes reproduced by repayment_security.test.sql against the prior schema.
-- Keep existing migrations immutable: this patch is applied forward.
create or replace function public.cancel_repayment(
  repayment_id_input uuid,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('cancel_repayment', idempotency_key_input);
  select * into repayment_row from public.repayments
  where id = repayment_id_input for update;

  -- Do not treat SQL NULL comparisons as authorization. Check access even on retry.
  if not found then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id)
     or repayment_row.created_by is distinct from auth.uid() then
    raise exception 'CANNOT_CANCEL_OTHER_REPAYMENT' using errcode = '42501';
  end if;
  if result is not null then return result; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;

  update public.repayments set status = 'CANCELLED' where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id)
  values (repayment_row.loan_id, 'REPAYMENT_CANCELLED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'CANCELLED');
  perform private.complete_idempotent_command('cancel_repayment', idempotency_key_input, result);
  return result;
end;
$$;

create or replace function public.dispute_repayment(
  repayment_id_input uuid,
  idempotency_key_input uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  repayment_row public.repayments;
begin
  result := private.begin_idempotent_command('dispute_repayment', idempotency_key_input);
  select * into repayment_row from public.repayments
  where id = repayment_id_input for update;
  if not found then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  if not private.is_loan_member(repayment_row.loan_id) then
    raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501';
  end if;
  if repayment_row.created_by is null or repayment_row.created_by = auth.uid() then
    raise exception 'CANNOT_DISPUTE_OWN_REPAYMENT' using errcode = '42501';
  end if;
  if result is not null then return result; end if;
  if repayment_row.status <> 'PENDING' then raise exception 'REPAYMENT_NOT_PENDING'; end if;

  update public.repayments
  set status = 'DISPUTED', disputed_by = auth.uid(), disputed_at = now()
  where id = repayment_row.id;
  insert into public.loan_events (loan_id, event_type, actor_id, entity_type, entity_id)
  values (repayment_row.loan_id, 'REPAYMENT_DISPUTED', auth.uid(), 'repayment', repayment_row.id);
  result := jsonb_build_object('repayment_id', repayment_row.id, 'status', 'DISPUTED');
  perform private.complete_idempotent_command('dispute_repayment', idempotency_key_input, result);
  return result;
end;
$$;

-- Restrict these two replaced public entry points; a full ACL inventory follows in M2.
revoke execute on function public.cancel_repayment(uuid, uuid) from public, anon;
revoke execute on function public.dispute_repayment(uuid, uuid) from public, anon;
grant execute on function public.cancel_repayment(uuid, uuid) to authenticated;
grant execute on function public.dispute_repayment(uuid, uuid) to authenticated;
