create or replace function public.get_my_loans()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;

  return coalesce((
    select jsonb_agg(item order by created_at desc)
    from (
      select l.created_at,
        jsonb_build_object(
          'id', l.id,
          'principal_minor', l.principal_minor,
          'balance_minor', l.principal_minor - coalesce((
            select sum(r.amount_minor) from public.repayments r
            where r.loan_id = l.id and r.status = 'CONFIRMED'
          ), 0),
          'currency', l.currency,
          'due_date', l.due_date,
          'status', l.status,
          'my_role', mine.role,
          'purpose', l.purpose
        ) as item
      from public.loans l
      join public.loan_members mine on mine.loan_id = l.id
      where mine.user_id = auth.uid() and mine.membership_status = 'ACCEPTED'
    ) summaries
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_loan_room(loan_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  loan_row public.loans;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000'; end if;
  if not private.is_loan_member(loan_id_input) then raise exception 'LOAN_ACCESS_DENIED' using errcode = '42501'; end if;

  select * into loan_row from public.loans where id = loan_id_input;
  if not found then raise exception 'LOAN_NOT_FOUND'; end if;

  return jsonb_build_object(
    'id', loan_row.id,
    'principal_minor', loan_row.principal_minor,
    'balance_minor', loan_row.principal_minor - coalesce((
      select sum(amount_minor) from public.repayments
      where loan_id = loan_row.id and status = 'CONFIRMED'
    ), 0),
    'currency', loan_row.currency,
    'loan_date', loan_row.loan_date,
    'due_date', loan_row.due_date,
    'purpose', loan_row.purpose,
    'note', loan_row.note,
    'status', loan_row.status,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', member.role,
        'membership_status', member.membership_status,
        'display_name', profile.display_name
      ) order by member.role)
      from public.loan_members member
      left join public.profiles profile on profile.id = member.user_id
      where member.loan_id = loan_row.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'event_type', event.event_type,
        'created_at', event.created_at,
        'metadata', event.metadata
      ) order by event.created_at desc)
      from public.loan_events event where event.loan_id = loan_row.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_my_loans() to authenticated;
grant execute on function public.get_loan_room(uuid) to authenticated;
