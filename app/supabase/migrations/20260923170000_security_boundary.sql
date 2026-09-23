begin;
set local lock_timeout = '5s';

-- These helpers are evaluated by RLS policies for authenticated callers. The
-- initial schema granted authenticated explicitly but left PostgreSQL's
-- default PUBLIC execute privilege in place.
revoke all on function private.is_loan_member(uuid) from public, anon, authenticated;
revoke all on function private.shares_loan_with(uuid) from public, anon, authenticated;
grant execute on function private.is_loan_member(uuid) to authenticated;
grant execute on function private.shares_loan_with(uuid) to authenticated;

-- Future private helpers must opt roles in explicitly, matching public RPCs.
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

commit;
