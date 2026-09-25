import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: jsonHeaders });

type WorkItem = { audit_id: string; user_id: string };

function isMissingUser(error: { status?: number; code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.status === 404 ||
      error.code === 'user_not_found' ||
      error.message?.toLowerCase().includes('user not found')),
  );
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const reconcileSecret = Deno.env.get('ACCOUNT_DELETION_RECONCILE_SECRET');
  if (!url || !serviceRoleKey || !reconcileSecret)
    return json({ error: 'SERVER_MISCONFIGURED' }, 500);
  if (request.headers.get('x-reconcile-secret') !== reconcileSecret)
    return json({ error: 'AUTHENTICATION_REQUIRED' }, 401);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('lease_account_deletion_reconciliations', {
    limit_input: 10,
  });
  if (error) return json({ error: 'RECONCILIATION_LEASE_FAILED' }, 500);

  let completed = 0;
  let deferred = 0;
  for (const item of (data ?? []) as WorkItem[]) {
    const lookup = await admin.auth.admin.getUserById(item.user_id);
    let operationFailed = false;
    if (lookup.data.user) {
      const deletion = await admin.auth.admin.deleteUser(item.user_id, false);
      operationFailed = Boolean(deletion.error);
    } else if (!isMissingUser(lookup.error)) {
      operationFailed = true;
    }

    if (!operationFailed) {
      const finish = await admin.rpc('finish_account_deletion', {
        audit_id_input: item.audit_id,
        user_id_input: item.user_id,
        outcome_input: 'COMPLETED',
        failure_reason_input: null,
      });
      if (!finish.error) {
        completed += 1;
        continue;
      }
    }

    deferred += 1;
    const failureCode = operationFailed
      ? 'AUTH_RECONCILIATION_FAILED'
      : 'AUDIT_FINALIZATION_FAILED';
    const recorded = await admin.rpc('record_account_deletion_attempt_failure', {
      audit_id_input: item.audit_id,
      user_id_input: item.user_id,
      failure_reason_input: failureCode,
    });
    if (recorded.error) console.error('account deletion reconciliation audit failure');
  }

  return json({ leased: (data ?? []).length, completed, deferred });
});
