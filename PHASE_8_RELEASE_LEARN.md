# Phase 8 — Release & Learn

> **Superseded release sequencing, 2026-09-16:** Follow [the Android release plan](KE_HOACH_RA_MAT_ANDROID.md). The owner confirmed one developer and Android first, iOS later. The historical requirement below for both platform artifacts does not block an Android-only release. Security, integrity, deletion, privacy and operational gates still apply to the released platform.

**Status:** In progress — preparation only; no store submission or public rollout has occurred.

## Repository evidence

- CI installs deterministically with `npm ci` and runs the unified `npm run validate` gate (format, lint, TypeScript, unit tests, and web static export).
- EAS project configuration and Android/iOS production identifiers exist.
- Product README describes safe local run, Supabase migration workflow, quality checks and build commands.
- Progress report separates code-ready work from required account-owner actions.
- Local `npm run validate` passed format, lint, TypeScript and 11 unit tests; its static export generated `dist/index.html` and 11 static routes on 22/08/2026. Expo reports missing Sentry organization/project configuration, which is expected until the Sentry owner gate is completed.
- `npm audit --omit=dev --audit-level=high` found 12 moderate transitive Expo/xcode → uuid advisories. The proposed force fix changes Expo splash-screen across a breaking boundary; no forced dependency change was made.

## Beta gate

Do not enter public beta until all of these have evidence:

1. Two-account invite → join → active-room test passes.
2. Two-account repayment integrity and concurrency matrix passes.
3. RLS negative/attacker matrix passes on a reproducible test environment.
4. Account deletion worker is deployed and privacy-reviewed.
5. Push opt-out, delivery deduplication and timezone behavior pass on real devices.
6. Sentry receives a scrubbed test event and release source maps.
7. Android and iOS preview artifacts both install successfully.

## Human/account-owner release work

- Store listing, screenshots, localized metadata, age ratings and privacy/data-safety answers.
- Apple Developer credentials, iOS encryption declaration and TestFlight configuration.
- Google Play developer verification/testing requirements and staged rollout percentage.
- Public Privacy Policy and Terms URLs.
- Production Supabase project/secrets, Google OAuth configuration, Expo push credentials and Sentry credentials.

## Initial operational metrics

- Create → invite share rate.
- Invite → join conversion and failed invite rate.
- Repayment submitted → confirmed/disputed rate.
- RLS/security errors, sync failures and crash-free sessions.
- Returning users managing an active Loan Room.
