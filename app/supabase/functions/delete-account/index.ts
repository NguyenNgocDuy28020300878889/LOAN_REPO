import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store',
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

function statusForClaimError(message: string) {
  if (message.includes('REAUTHENTICATION_REQUIRED')) return 401;
  if (message.includes('ACCOUNT_DELETION_BLOCKED')) return 409;
  if (message.includes('DELETION_ALREADY_PROCESSING')) return 409;
  if (message.includes('DELETION_REQUEST_REQUIRED')) return 409;
  return 500;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return json({ error: 'SERVER_MISCONFIGURED' }, 500);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'AUTHENTICATION_REQUIRED' }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) return json({ error: 'AUTHENTICATION_REQUIRED' }, 401);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claim, error: claimError } = await admin.rpc('claim_account_deletion', {
    user_id_input: user.id,
  });
  if (claimError) {
    const status = statusForClaimError(claimError.message);
    const code =
      status === 401
        ? 'REAUTHENTICATION_REQUIRED'
        : claimError.message.includes('ACCOUNT_DELETION_BLOCKED')
          ? 'ACCOUNT_DELETION_BLOCKED'
          : claimError.message.includes('DELETION_ALREADY_PROCESSING')
            ? 'DELETION_ALREADY_PROCESSING'
            : claimError.message.includes('DELETION_REQUEST_REQUIRED')
              ? 'DELETION_REQUEST_REQUIRED'
              : 'ACCOUNT_DELETION_FAILED';
    return json({ error: code }, status);
  }

  const claimed = claim as { status?: string; audit_id?: string } | null;
  if (claimed?.status === 'COMPLETED') return json({ success: true });
  if (!claimed?.audit_id) return json({ error: 'ACCOUNT_DELETION_FAILED' }, 500);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    const { error: finishError } = await admin.rpc('finish_account_deletion', {
      audit_id_input: claimed.audit_id,
      user_id_input: user.id,
      outcome_input: 'FAILED',
      failure_reason_input: 'AUTH_DELETE_FAILED',
    });
    if (finishError) console.error('delete-account audit failure', finishError.code);
    return json({ error: 'ACCOUNT_DELETION_FAILED' }, 500);
  }

  const { error: finishError } = await admin.rpc('finish_account_deletion', {
    audit_id_input: claimed.audit_id,
    user_id_input: user.id,
    outcome_input: 'COMPLETED',
    failure_reason_input: null,
  });
  if (finishError) {
    console.error('delete-account completion audit failure', finishError.code);
    return json({ error: 'ACCOUNT_DELETION_FINALIZATION_FAILED' }, 500);
  }

  return json({ success: true });
});
