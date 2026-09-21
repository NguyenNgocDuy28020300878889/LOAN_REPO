# Local database regression tests

2026-09-21: `schema_completeness.test.sql` adds 20 checks for UUID primary keys, indexed foreign keys, RLS/policy coverage, timestamps, constrained audit references, and direct-write isolation even when table grants are temporarily added inside a rollback-only test. Total: 86 assertions across five files. See `docs/DATABASE_DESIGN.md` for the non-destructive local migration and opt-in seed workflow. Do not reset existing databases to run these tests.

SQL tests use synthetic users and roll back fixtures. They do not use a linked remote project or a service-role client to assert authorization.

2026-09-21 push notifications: `push_notifications.test.sql` adds 39 assertions (125 total across six files) for device ownership, worker-only access, atomic event enqueue, leases, retry/receipts, time zones, deduplication, due-date changes, settlement, preferences and account rebinding. Fixtures include synthetic `auth.sessions`; no real Expo tokens are used and nothing is sent. Invitation-management fixture UUIDs now use a separate namespace from `seed.sql`, so tests also pass on a seeded local database.

From `app/`, with Docker running:

```sh
npm run db:start
npm run db:test
npm run db:test:concurrency
```

The CLI project is `loan-local`. Database tests explicitly use `--local`; never replace this with a production database URL. The CI database job starts an isolated database from the complete migration history before testing.

`repayment_security.test.sql` checks outsider reads, definer RPC authorization, direct financial/audit writes, self-confirmation, NULL-creator cancellation after account deletion, dispute timestamps, unchanged balance and idempotent audit events.

`invite_flow.test.sql` exercises the real create/preview/accept/decline RPCs and anonymous preview denial. `command_receipts.test.sql` covers payload binding, replay, settlement cancellation and audit. `invite_management.test.sql` covers owner-only rotation/revocation and stale tokens. Together: 66 assertions.

`npm run db:test:concurrency` opens separate PostgreSQL connections and waits until both commands contend for locks before releasing a gate transaction. It checks competing settlements, identical retries, confirm versus cancel, and invitation join versus revoke. It commits synthetic fixtures and deletes only this run's random IDs in `finally`; it accepts no remote target. If the process is forcibly killed, fixture cleanup may require local database reset.

For real GoTrue/Mailpit email and PKCE integration, create the ignored directory `.local`, write `supabase status --output json` to `.local/local-status.json`, then run `npm run test:auth:local`. The script accepts only localhost API port 54321/Mailpit port 54324, tests normal client JWT/RPC access, and uses the local admin key only to delete its synthetic user. It tests signup verification, persisted sessions, code replay rejection, logout, recovery and password replacement. Local Auth now requires 12-character passwords and email confirmation; restart local services after changing `config.toml`.

For browser acceptance, run `npm run export:browser:local`, then `npm run test:browser:local`. Use Chrome installed at the default path or set `CHROME_BIN`. Export disables dotenv and clears Metro, placing a local-only build in `.local/browser-dist`. The journey uses fresh headless profiles and three synthetic users: lender, borrower and outsider. It drives create/cancel confirmation, manual link sharing, an initially empty list receiving a new loan, anonymous privacy, login return, joining, repayment submission, a response dropped after server commit, retry after reload with the same key, confirmation/cancellation, settlement with an automatic cancellation reason, outsider denial, and logout. HTTP and WebSocket connect to actual local services; external origins are blocked. The Web Share capability is disabled for the owner context to exercise manual copying without OS dialogs. No financial response or Realtime event is fabricated. Assertions inspect this run's UUID fixtures through local Docker PostgreSQL; the admin API only creates/deletes synthetic users. Cleanup runs in `finally`; forcible termination may leave fixtures. Screenshots are in ignored `.local/`. CI runs the same commands without cloud credentials. This does not replace native Android installation, dialogs or device lifecycle testing.

These suites do not complete the T01–T20 release matrix. Remote token revocation, cloud/device Realtime and offline recovery, Google provider configuration, Edge Functions and Android-device E2E still require separate evidence. SQL identity claims model roles; the separate Auth integration checks actual local JWT verification. CI includes these commands but has not yet been run on GitHub for this working tree.

The browser export records a SHA-256 digest of application source, assets and build configuration/package files. Acceptance rejects stale exports, and export fails if those inputs change while bundling. Rebuild after source edits. The digest excludes `.env`; the manifest contains no credentials. This protects local acceptance from testing an older bundle; it is not an Android artifact attestation.
