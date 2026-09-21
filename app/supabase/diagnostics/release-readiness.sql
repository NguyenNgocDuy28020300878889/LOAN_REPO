-- Analysis probes, NOT passing acceptance tests. Run against loan-local only.
-- Synthetic fixtures and all writes roll back. A reported risk is still unfixed.
begin;
set local search_path = public, extensions;
create temporary table readiness_observations (case_name text, observation text);
grant select, insert on readiness_observations to authenticated;

insert into auth.users (id, email) values
  ('91000000-0000-4000-8000-000000000001', 'readiness-a@example.invalid'),
  ('91000000-0000-4000-8000-000000000002', 'readiness-b@example.invalid');
insert into public.loans (id, principal_minor, currency, loan_date, due_date, status, created_by)
values ('92000000-0000-4000-8000-000000000001', 1000, 'VND', '2026-09-01', '2026-10-01', 'ACTIVE', '91000000-0000-4000-8000-000000000001');
insert into public.loan_members (loan_id, user_id, role, membership_status, joined_at) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'LENDER', 'ACCEPTED', now()),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'BORROWER', 'ACCEPTED', now());

set local role authenticated;
set local request.jwt.claim.sub = '91000000-0000-4000-8000-000000000001';
do $$
declare first_result jsonb; second_result jsonb; full_result jsonb;
begin
  begin
    perform public.create_loan('LENDER', 1000, 'VND', '2026-09-01', '2026-10-01', null, null, '93000000-0000-4000-8000-000000000001');
    insert into readiness_observations values ('create_loan', 'completed');
  exception when others then
    insert into readiness_observations values ('create_loan', sqlstate || ': ' || sqlerrm);
  end;
  begin
    perform public.get_loan_invite_preview(repeat('a', 64));
    insert into readiness_observations values ('invite_preview_synthetic_token', 'completed');
  exception when others then
    insert into readiness_observations values ('invite_preview_synthetic_token', sqlstate || ': ' || sqlerrm);
  end;
  first_result := public.submit_repayment('92000000-0000-4000-8000-000000000001', 100, '2026-09-02', null, null, '93000000-0000-4000-8000-000000000002');
  begin
    second_result := public.submit_repayment('92000000-0000-4000-8000-000000000001', 200, '2026-09-02', null, null, '93000000-0000-4000-8000-000000000002');
    insert into readiness_observations values ('same_key_changed_amount',
      'accepted; cached_response_equal=' || (first_result = second_result)::text);
  exception when others then
    insert into readiness_observations values ('same_key_changed_amount', sqlstate || ': ' || sqlerrm);
  end;
  perform public.submit_repayment('92000000-0000-4000-8000-000000000001', 100, '2026-09-02', null, null, '93000000-0000-4000-8000-000000000003');
  insert into readiness_observations select 'retry_new_key_same_payload',
    'pending_rows=' || count(*)::text from public.repayments
    where loan_id = '92000000-0000-4000-8000-000000000001' and amount_minor = 100;
  full_result := public.submit_repayment('92000000-0000-4000-8000-000000000001', 1000, '2026-09-02', null, null, '93000000-0000-4000-8000-000000000004');
  perform set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
  perform public.confirm_repayment((full_result->>'repayment_id')::uuid, '93000000-0000-4000-8000-000000000005');
  insert into readiness_observations select 'pending_after_paid_in_full',
    'loan_status=' || (select status::text from public.loans where id = '92000000-0000-4000-8000-000000000001') || '; pending_rows=' || count(*)::text
    from public.repayments where loan_id = '92000000-0000-4000-8000-000000000001' and status = 'PENDING';
end;
$$;
reset role;
select * from readiness_observations order by case_name;
rollback;
