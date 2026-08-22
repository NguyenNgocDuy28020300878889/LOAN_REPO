do $$
begin
  alter publication supabase_realtime add table public.loans;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.loan_members;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.repayments;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.loan_events;
exception when duplicate_object then null;
end $$;
