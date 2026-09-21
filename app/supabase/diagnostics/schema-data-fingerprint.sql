select 'profiles', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.profiles row_data
union all select 'loans', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.loans row_data
union all select 'loan_members', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.loan_members row_data
union all select 'loan_invites', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.loan_invites row_data
union all select 'repayments', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.repayments row_data
union all select 'loan_events', count(*), md5(coalesce(string_agg(to_jsonb(row_data)::text, '' order by id), '')) from public.loan_events row_data
union all select 'idempotency_keys', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.idempotency_keys row_data
union all select 'account_deletion_requests', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by id), '')) from public.account_deletion_requests row_data
union all select 'notification_preferences', count(*), md5(coalesce(string_agg((to_jsonb(row_data) - 'updated_at')::text, '' order by user_id), '')) from public.notification_preferences row_data
order by 1;
