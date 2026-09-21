-- Read-only inventory. Run on the explicitly verified staging target before
-- a migration dry-run. Counts only; do not export financial rows or tokens.
begin read only;
set local statement_timeout='15s';
select 'pgcrypto_schema' as check_name, n.nspname as result
from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';

select 'principal_exceeds_js_safe_integer' as check_name,count(*) as affected_rows
from public.loans where principal_minor>9007199254740991
union all
select 'repayment_exceeds_js_safe_integer',count(*) from public.repayments where amount_minor>9007199254740991
union all
select 'repaid_with_pending_proposals',count(*) from public.loans l
where l.status='REPAID' and exists(select 1 from public.repayments r where r.loan_id=l.id and r.status='PENDING')
union all
select 'confirmed_total_exceeds_principal',count(*) from public.loans l
where (select coalesce(sum(r.amount_minor),0) from public.repayments r where r.loan_id=l.id and r.status='CONFIRMED')>l.principal_minor;

select p.oid::regprocedure::text as function_signature,
  has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  p.prosecdef as security_definer,p.proconfig as function_settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname=any(array['create_loan','get_loan_invite_preview','accept_loan_invite','decline_loan_invite','manage_loan_invite','submit_repayment','confirm_repayment','cancel_repayment','dispute_repayment']))
or (n.nspname='private' and p.proname in ('begin_idempotent_command','complete_idempotent_command'))
order by function_signature;

select 'anonymous_schema_create' as check_name,has_schema_privilege('anon','public','CREATE') as allowed
union all select 'authenticated_schema_create',has_schema_privilege('authenticated','public','CREATE');
rollback;
