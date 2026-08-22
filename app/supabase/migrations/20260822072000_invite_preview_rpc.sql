create or replace function public.get_loan_invite_preview(invite_token_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.loan_invites;
  loan_row public.loans;
begin
  select * into invite_row
  from public.loan_invites
  where token_hash = encode(digest(invite_token_input, 'sha256'), 'hex');

  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if invite_row.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;
  if invite_row.used_at is not null then raise exception 'INVITE_ALREADY_USED'; end if;
  if invite_row.revoked_at is not null then raise exception 'INVITE_REVOKED'; end if;

  select * into loan_row from public.loans where id = invite_row.loan_id;
  if loan_row.status <> 'PENDING' then raise exception 'LOAN_NOT_PENDING'; end if;

  return jsonb_build_object(
    'loan_id', loan_row.id,
    'principal_minor', loan_row.principal_minor,
    'currency', loan_row.currency,
    'loan_date', loan_row.loan_date,
    'due_date', loan_row.due_date,
    'purpose', loan_row.purpose,
    'target_role', invite_row.target_role,
    'expires_at', invite_row.expires_at
  );
end;
$$;

grant execute on function public.get_loan_invite_preview(text) to anon, authenticated;
