# Environments

## Development

- `EXPO_PUBLIC_APP_ENV=development`
- Local Supabase DEV project only.
- Sentry disabled unless a development DSN is explicitly supplied.

## Staging

- `EXPO_PUBLIC_APP_ENV=staging`
- Separate Supabase project, storage bucket, push credentials and Sentry environment.
- All migrations and RLS tests run here before production.

## Production

- `EXPO_PUBLIC_APP_ENV=production`
- Separate production Supabase project and Sentry environment.
- Secrets are CI/EAS secrets; never use `EXPO_PUBLIC_` for service-role keys, Sentry auth tokens or store credentials.

## Local setup

Copy `.env.example` to `.env` and populate only the required public values. `.env` remains untracked.

The currently configured URLs map to `development` and `staging`. Enter each project's **publishable key** (or legacy anon key if that is what the dashboard supplies) in its matching `EXPO_PUBLIC_SUPABASE_*_PUBLISHABLE_KEY` variable. Never use a service-role key in the app.
