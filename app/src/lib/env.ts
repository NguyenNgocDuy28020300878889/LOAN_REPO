type PublicEnvironment = 'development' | 'staging' | 'production';

const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

if (!['development', 'staging', 'production'].includes(environment)) {
  throw new Error('EXPO_PUBLIC_APP_ENV must be development, staging, or production.');
}

const appEnv = environment as PublicEnvironment;

const supabaseByEnvironment = {
  development: {
    url: process.env.EXPO_PUBLIC_SUPABASE_DEVELOPMENT_URL ?? '',
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY ?? '',
  },
  staging: {
    url: process.env.EXPO_PUBLIC_SUPABASE_STAGING_URL ?? '',
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_STAGING_PUBLISHABLE_KEY ?? '',
  },
  production: {
    url: process.env.EXPO_PUBLIC_SUPABASE_PRODUCTION_URL ?? '',
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY ?? '',
  },
} as const;

export const env = {
  appEnv,
  supabase: supabaseByEnvironment[appEnv],
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
} as const;
