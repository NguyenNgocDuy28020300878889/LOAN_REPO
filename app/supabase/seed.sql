begin;

do $$
begin
  if current_setting('loan.allow_local_seed', true) is distinct from 'on' then
    raise exception 'Run the documented local-only seed command with loan.allow_local_seed=on';
  end if;
  if exists (
    select 1 from auth.users
    where id in ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002')
      and email is distinct from case id
        when '91000000-0000-4000-8000-000000000001'::uuid then 'loan-seed-lender@example.invalid'
        else 'loan-seed-borrower@example.invalid' end
  ) then
    raise exception 'Seed UUID collision; existing users will not be modified';
  end if;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
  ('91000000-0000-4000-8000-000000000001', 'loan-seed-lender@example.invalid', '{"full_name":"Demo lender","locale":"vi"}'),
  ('91000000-0000-4000-8000-000000000002', 'loan-seed-borrower@example.invalid', '{"full_name":"Demo borrower","locale":"vi"}')
on conflict (id) do nothing;

do $$
declare
  loan_result jsonb;
  repayment_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
  perform public.create_loan('LENDER', 500000, 'VND', '2026-09-01', '2026-10-01',
    'Demo: pending invitation', null, '92000000-0000-4000-8000-000000000001');
  loan_result := public.create_loan('LENDER', 1000000, 'VND', '2026-09-01', '2026-10-01',
    'Demo: shared loan', null, '92000000-0000-4000-8000-000000000002');
  perform set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
  if loan_result->>'invite_token' is not null then
    perform public.accept_loan_invite(loan_result->>'invite_token', '92000000-0000-4000-8000-000000000003');
  end if;
  repayment_result := public.submit_repayment((loan_result->>'loan_id')::uuid, 200000,
    '2026-09-10', 'Demo transfer', null, '92000000-0000-4000-8000-000000000004');
  perform set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
  perform public.confirm_repayment((repayment_result->>'repayment_id')::uuid,
    '92000000-0000-4000-8000-000000000005');
end;
$$;

commit;
