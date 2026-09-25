# delete-account Edge Function

Deploy both functions after applying all migrations and reviewing the published privacy/data-retention text:

```bash
npx supabase functions deploy delete-account
npx supabase functions deploy reconcile-account-deletions --no-verify-jwt
```

The platform supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; never put the service-role key in the mobile app or repository. Keep JWT verification enabled.

The caller must first invoke `request_account_deletion()` from a session created within the last 15 minutes. `claim_account_deletion()` atomically rechecks that no active loan or unresolved repayment blocks deletion, leases the request, and creates a private audit record. Only `service_role` can claim or finish work.

Deleting `auth.users` cascades the profile, notification preferences, push devices, command receipts, sessions, identities and deletion request. Existing shared financial rows remain for the other participant, while user/actor foreign keys become `NULL`. Finalization removes free-text purpose, note and payment method from affected shared rows. The private audit retains the former UUID for at most 180 days; it is never exposed to app roles.

Set a random `ACCOUNT_DELETION_RECONCILE_SECRET` with Supabase Secrets. Store the same value in Vault and schedule an HTTP POST to `reconcile-account-deletions` every five minutes with the `x-reconcile-secret` header. Never put this value in migrations or client code. The function leases stale work, checks Auth with `getUserById`, retries deletion when needed and finishes the durable audit. Configure an alert for records that remain `PROCESSING` after five attempts.

Schedule `select public.purge_account_deletion_audit(180);` daily as a database Cron job. The function is restricted to `service_role` and refuses retention shorter than 30 or longer than 365 days.
