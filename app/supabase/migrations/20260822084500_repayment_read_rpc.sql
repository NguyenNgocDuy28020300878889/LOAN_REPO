create or replace function public.get_loan_repayments(loan_id_input uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  if not private.is_loan_member(loan_id_input) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'amount_minor', r.amount_minor, 'payment_date', r.payment_date,
    'method', r.method, 'note', r.note, 'status', r.status, 'created_by', r.created_by,
    'created_at', r.created_at
  ) order by r.created_at desc) from public.repayments r where r.loan_id = loan_id_input), '[]'::jsonb);
end; $$;
grant execute on function public.get_loan_repayments(uuid) to authenticated;
