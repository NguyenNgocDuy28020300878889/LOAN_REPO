# Phase 7 — Product Readiness

**Status:** Code complete — awaiting external beta gates

## Completed in code

- Deep-link routes exist for invite, Loan Room, Auth callback and repayment flow.
- Financial actions have accessible labels and textual actions rather than color-only meaning.
- English and Vietnamese strings cover the implemented MVP screens, including loan/repayment states and timeline events returned by the database. Users can switch language in Preferences.
- For authenticated users, Preferences persists the explicit language choice through `profiles.locale` and restores it during session bootstrap; unauthenticated users retain the device-language default.
- ISO minor-unit money formatting is centralized and tested: zero-decimal (for example VND), two-decimal (USD) and three-decimal currencies (KWD).
- Loan Room and invitation preview render formatted currency and locale-aware dates instead of raw minor-unit/date strings.
- Create and repayment forms convert user decimal values to ISO minor units without rounding, so UI amounts cannot be silently interpreted as database minor-unit input.
- Ambiguous thousands/decimal separators are rejected rather than guessed; the forms state their explicit decimal-entry convention.
- Notification preferences are persisted through caller-scoped RPCs; Settings supports push and due-reminder opt-out before delivery infrastructure is added.
- Account-deletion audit migration is applied; an Edge Function source validates the caller and deletes only after a recorded request, while preserving non-PII financial audit records.
- Migration `20260822100000_account_deletion_history_retention.sql` is applied to DEV. It makes loan, invitation, repayment and event actor references anonymous on auth-user deletion, so foreign keys do not block deletion while shared financial history remains.
- Settings provides a deliberate account-deletion request with an explanation of profile removal versus retained shared financial history.
- When unauthenticated, Preferences still exposes language selection but does not call protected preference RPCs; it gives a clear sign-in action before notification or deletion controls.
- Preference loading has explicit loading, error/retry and unauthenticated states rather than an indefinite spinner.
- Production navigation no longer exposes Expo Starter, Explore or Docs; it exposes Loans and Settings.
- The legacy `/explore` path redirects to Settings, so static export retains backward-compatible routing without exposing starter content.
- Removed unused Expo animated splash/logo components and their long-running animation; the configured native splash remains managed by Expo app configuration.

## Human/external gates before beta

- Configure Expo push credentials, notification permission copy, an Expo push token registration backend and a scheduled due-date worker.
- Configure Google OAuth provider/client and production redirect URLs; Apple Sign In remains intentionally deferred.
- Configure Sentry DSN/org/project/token and verify a scrubbed test event.
- Review and deploy the account-deletion Edge Function with service-role secret and privacy/legal approval.
- Decide encrypted versus unencrypted offline read cache storage.
- Run RLS attacker matrix, two-device convergence and financial E2E suite on a test environment.
- Supply public Privacy Policy/Terms URLs, App Store privacy answers and Play Data Safety answers.

## Not claimed as complete

No notification is sent merely because UI routing exists. Push scheduling, delivery, timezone behavior and opt-out require the external credentials and a test device workflow above.
