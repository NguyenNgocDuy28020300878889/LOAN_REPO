# delete-account Edge Function

Deploy only after privacy/legal review:

```bash
npx supabase functions deploy delete-account
```

The platform supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; never put the service-role key in the mobile app or repository. The caller must first invoke `request_account_deletion()`. Deleting `auth.users` cascades profile/deletion-request PII while existing loan-member and event foreign keys preserve financial audit history as anonymous former participants.
