import { ProviderError, runPushWorker } from './core.ts';

Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('PUSH_WORKER_SECRET');
  if (!secret || secret.length < 32 || request.headers.get('x-worker-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // Fail closed until FCM, migrations and credentials have been verified by the owner.
  if (Deno.env.get('PUSH_DELIVERY_ENABLED') !== 'true') {
    return Response.json({ enabled: false });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!url || !key || !expoAccessToken)
    return new Response('Missing worker configuration', { status: 503 });
  try {
    const result = await runPushWorker(
      async (name, args) => {
        const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('WorkerDatabaseError');
        const text = await response.text();
        return text ? JSON.parse(text) : null;
      },
      async (path, body) => {
        const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${expoAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw new ProviderError(response.status === 429 || response.status >= 500);
        return response.json();
      },
    );
    return Response.json(result);
  } catch {
    // Never log Expo tokens, JWTs, secret headers or financial content.
    return new Response('Worker failed; leased work will be recovered', { status: 503 });
  }
});
