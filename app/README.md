# Loan

Loan is a shared-record app for personal loans: one lender, one borrower, and one canonical timeline. It does not process money or act as a lender.

## Run locally

```bash
npm ci
npm run start
```

Copy `.env.example` to `.env` and populate only publishable Supabase configuration. Never commit `.env`, service-role keys, EAS tokens, or Sentry auth tokens.

## Quality checks

```bash
npm run validate
```

## Environments

The app selects Supabase configuration through `EXPO_PUBLIC_APP_ENV` (`development`, `staging`, or `production`). Environment details are in `docs/ENVIRONMENTS.md`.

## Supabase

Migrations live in `supabase/migrations`. Apply only to the linked intended project:

```bash
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The `delete-account` Edge Function must be reviewed and deployed with Supabase-managed service-role secrets; do not put those secrets in this app.

## Builds

```bash
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

Production builds, store submission, OAuth provider configuration, notifications, Sentry setup, and privacy disclosures require account owner action. See the root `BAO_CAO_TIEN_DO.md` before beta or release.
