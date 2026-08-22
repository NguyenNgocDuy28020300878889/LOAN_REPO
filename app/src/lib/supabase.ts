import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

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
    },
  });

  return client;
}
