import 'react-native-url-polyfill/auto';

import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';
import { sessionStorage } from '@/lib/session-storage';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient() {
  if (client) return client;

  if (!env.supabase.url || !env.supabase.publishableKey) {
    throw new Error(
      `Supabase ${env.appEnv} URL or publishable key is missing. Fill the matching values in .env.`,
    );
  }

  client = createClient<Database>(env.supabase.url, env.supabase.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: sessionStorage,
      flowType: 'pkce',
      lock: processLock,
    },
  });

  return client;
}
