import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST')
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey)
    return Response.json({ error: 'SERVER_MISCONFIGURED' }, { status: 500, headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization)
    return Response.json(
      { error: 'AUTHENTICATION_REQUIRED' },
      { status: 401, headers: corsHeaders },
    );
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user)
    return Response.json(
      { error: 'AUTHENTICATION_REQUIRED' },
      { status: 401, headers: corsHeaders },
    );
  const admin = createClient(url, serviceRoleKey);
  const { data: requestRow } = await admin
    .from('account_deletion_requests')
    .select('requested_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!requestRow)
    return Response.json(
      { error: 'DELETION_REQUEST_REQUIRED' },
      { status: 409, headers: corsHeaders },
    );
  await admin
    .from('account_deletion_requests')
    .update({ status: 'PROCESSING', failure_reason: null })
    .eq('user_id', user.id);
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    await admin
      .from('account_deletion_requests')
      .update({ status: 'FAILED', failure_reason: 'AUTH_DELETE_FAILED' })
      .eq('user_id', user.id);
    await admin.schema('private').from('account_deletion_audit').insert({
      former_user_id: user.id,
      requested_at: requestRow.requested_at,
      outcome: 'FAILED',
      failure_reason: 'AUTH_DELETE_FAILED',
    });
    return Response.json(
      { error: 'ACCOUNT_DELETION_FAILED' },
      { status: 500, headers: corsHeaders },
    );
  }
  await admin.schema('private').from('account_deletion_audit').insert({
    former_user_id: user.id,
    requested_at: requestRow.requested_at,
    outcome: 'COMPLETED',
  });
  return Response.json({ success: true }, { headers: corsHeaders });
});
