# Environments

Updated: 2026-09-17. Release plan: [Android first, one developer](../../KE_HOACH_RA_MAT_ANDROID.md).

Latest authentication direction: **Google primary, eight-digit email OTP fallback**. Google is now enabled in both hosted projects using the owner's `loan-test-508813` Web OAuth client. Exact callbacks and real authorization redirects to Google were verified; cloud web exports use `EXPO_PUBLIC_GOOGLE_AUTH_READY=true`. Interactive Google login/session and Android device acceptance remain pending. See [Google setup, exact callbacks and recovery limits](GOOGLE_SIGN_IN.md). SMTP readiness is independent; client secrets never belong in public environment variables.

For `npm run start` using the hosted DEV backend, the local `.env` must also set `EXPO_PUBLIC_GOOGLE_AUTH_READY=true` and `EXPO_PUBLIC_EMAIL_OTP_READY=false` while SMTP is unavailable. These values were missing and have been corrected on this workstation. Restart Expo after changing public environment variables. The intentionally local backend preview on port 8081 still has Google disabled; use hosted DEV on port 8082 to sign in with Google.

Email authentication uses an eight-digit code, as selected by the owner; see [Email OTP setup and cloud prerequisites](EMAIL_OTP.md). DEV and STAGING have now been restored and migrated. Their HTTPS Auth/API connections and anonymous access denial passed checks. Gmail delivery is still blocked by missing custom SMTP; the cloud browser exports explicitly set `EXPO_PUBLIC_EMAIL_OTP_READY=false` until delivery is configured and verified.

Security gates: [S0–S5 and required evidence](../../KE_HOACH_BAO_MAT.md). Execution has resumed with owner authorization. Passing local checks is not production acceptance.

## Latest Android test build — 2026-09-17

EAS build `d934d9ba-c2fb-41cb-b821-522b446eeb7a` finished successfully: version `1.0.0` (code `2`), package `com.loanappmobiles.loanapp.staging`, preview profile. It targets hosted STAGING with Google enabled and email OTP disabled pending SMTP. [APK download and device test steps](ANDROID_TEST_APK.md). Hosted DEV/STAGING Auth/API and anonymous financial access denial were rechecked successfully on 2026-09-17. Android device acceptance remains pending. Earlier build notes below are historical.

## Current implementation versus target

`src/lib/env.ts` selects `development`, `staging`, or `production` using `EXPO_PUBLIC_APP_ENV`, defaulting to development for local use. `eas.json` now explicitly maps each profile. `app.config.js` and the EAS post-install hook validate build variables through `scripts/build-environment.cjs` and fail on missing/mismatched values. The dynamic config gives development/staging distinct package IDs and schemes; production identity is unchanged.

On 2026-09-16, the EAS preview environment was initially empty. Four staging public configuration values were validated and uploaded: app environment, staging URL/key and expected project reference. Supabase staging migrations/Auth and installed binary behavior remain unverified. No production configuration or remote database was changed.

On 2026-09-16, the owner selected both DEV and STAGING for online connections. Both existing projects were restored via the Management API and reached `ACTIVE_HEALTHY`. DEV received four pending migrations; STAGING received the full 15-migration schema. Transactional dry-runs rolled back successfully before deployment; migration versions were verified afterward. All four SQL regression suites passed on each cloud project and rolled back their fixtures. No database was reset or replaced. [Cloud connection and SMTP setup](CLOUD_CONNECTION.md)

EAS builds use Node 24.16.0, matching the local validation runtime. The repository-root `.easignore` explicitly excludes local environment files, `.local`, signing keys, CLI link metadata and generated files. An EAS archive inspection on Windows initially included the nested app's `.env` despite Git ignoring it. The archive was inspected again after this fix: required source/config files remain and the excluded local paths are absent. Recheck the archive after changing ignore rules or the build CLI. [EAS upload exclusions](https://docs.expo.dev/build-reference/easignore/)

Build preflight can also be run manually with `npm run check:build-env -- preview` (or `production`) after supplying that environment's values. Do not include keys in command arguments or logs. Hosted preview/production currently require the canonical `https://<project-ref>.supabase.co` origin; custom API domains need an explicitly reviewed validation change.

The old Android preview build failed in its Sentry source-map upload task because the organization was missing. DEV/preview now set `SENTRY_DISABLE_AUTO_UPLOAD=true` until monitoring is configured. This skips upload, not runtime error collection if a DSN is supplied. Production retains the upload requirement and still needs Sentry credentials before its release gate can pass.

Android preview build `e9186536-9ae2-4067-9023-48775f738c29` finished successfully on EAS after the archive fix. Its build environment preflight passed remotely. See the [progress report](../../BAO_CAO_TIEN_DO.md) for the APK and artifact checks. Installation and staging Auth/API behavior still require device testing and an active staging backend.

## Required mapping

| Build profile | EAS environment | EXPO_PUBLIC_APP_ENV | Backend/data                                                   |
| ------------- | --------------- | ------------------- | -------------------------------------------------------------- |
| development   | development     | development         | Local Supabase or isolated DEV project; synthetic data         |
| preview       | preview         | staging             | Separate STAGING project; synthetic QA data                    |
| production    | production      | production          | Separate PRODUCTION project; real users, including closed beta |

EAS calls its middle environment `preview`; the app calls it `staging`. Set both explicitly. Closed testing is a distribution track, not a reason to put real user data into staging. Use production configuration for the signed AAB distributed to real beta users. [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/)

## Values and secrets

`EXPO_EXPECTED_SUPABASE_PROJECT_REF` is also required in EAS preview/production. It is a non-secret project identifier used to verify the selected URL; it does not replace server authentication or prove that a publishable key is valid. Legacy anon JWTs are inspected for role/project consistency; their signatures are not verified by this build guard.

Native variants: development uses `com.loanappmobiles.loanapp.dev` and `loan-development`; staging uses `com.loanappmobiles.loanapp.staging` and `loan-staging`; production keeps `com.loanappmobiles.loanapp` and `loan`. Configure the matching Auth redirect allowlist before device testing.

| Value                                                                                      | Where it belongs                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV`                                                                      | Explicit build profile/app configuration                      |
| `EXPO_PUBLIC_SUPABASE_DEVELOPMENT_URL`, `EXPO_PUBLIC_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY` | Development environment only                                  |
| `EXPO_PUBLIC_SUPABASE_STAGING_URL`, `EXPO_PUBLIC_SUPABASE_STAGING_PUBLISHABLE_KEY`         | EAS preview environment                                       |
| `EXPO_PUBLIC_SUPABASE_PRODUCTION_URL`, `EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY`   | EAS production environment                                    |
| `EXPO_PUBLIC_SENTRY_DSN`                                                                   | Per-environment public DSN; optional in DEV                   |
| Sentry organization/project and upload auth token                                          | Build configuration and protected CI/EAS secret for the token |
| Supabase service-role key, provider client secrets                                         | Server/provider secret configuration only                     |
| Store signing credentials, push provider private credentials                               | Managed signing/push or protected server configuration        |

Supabase publishable keys and public DSNs are client configuration, not authorization boundaries. RLS/RPC enforce data access. No service-role key, OAuth secret or signing credential belongs in the client bundle. EAS secret visibility cannot make a value secret after it is embedded in an application. [Expo visibility guidance](https://docs.expo.dev/eas/environment-variables/)

Copy `.env.example` to an untracked `.env` for local work. Populate the matching public values using a project's publishable key (or legacy anon key where applicable). Do not print credentials into logs or evidence records. Do not depend on a developer's local `.env` being available to remote builds.

When switching public environment variables in an existing workspace, clear Metro's transform cache (`expo start --clear` or `npm run export:web -- --clear`) and inspect the resulting bundle/artifact. A local verification reproduced an export retaining previous inlined URLs without `--clear`; environment variables in the launching shell alone are not artifact evidence. `npm run validate` clears that cache for its final export. CI browser tests use `npm run export:browser:local`, which disables dotenv loading, removes inherited public configuration and uses only the loopback URL/publishable key from `.local/local-status.json`. Output is isolated in `.local/browser-dist`.

For the local browser acceptance journey, run `npm run export:browser:local` followed by `npm run test:browser:local` with Chrome and the local Supabase services running. The test drives creation, joining, repayments, lost-response retry after reload, settlement and logout through the UI. HTTP and WebSocket reach local services; external origins are blocked. A third authenticated account checks room denial and absence of financial Realtime events. Synthetic fixtures are removed in `finally`. This verifies web behavior with real local services, not installation or native dialogs on Android.

## Environment isolation

- Configure provider callbacks and app return URLs for each environment; verify cold and warm auth/invite links. Separate DEV/STAGING app identifiers or another verified isolation strategy must prevent test builds from intercepting production links. Choose the strategy in M0; production identifiers remain stable.
- Keep database projects, user populations and Sentry environments separate. Isolate push registration by app/environment so test jobs cannot contact production users.
- Create storage buckets only if a shipped feature needs them; attachments are outside Android v1. Avoid unused infrastructure.
- Synthetic data only in DEV/STAGING. Do not copy production financial records there to debug.
- Sentry is enabled by the current code whenever a DSN exists, including DEV; supply a development DSN only deliberately.

## Migration and release workflow

Implementation evidence is tracked in [the 16 September security pass](IMPLEMENTATION_SECURITY_2026_09_16.md). Local Auth requires confirmed email, uses eight-digit OTPs with a 600-second expiry, and retains a 12-character minimum for legacy password accounts. Hosted Auth retains its existing settings: eight-digit OTPs, 3600-second expiry, confirmation required, 60-second send interval, 30 verification attempts per configured rate-limit window, and six-character legacy password minimum. Proposed hosted policy changes were not applied. Hosted template updates were rejected by Supabase because free projects using the default email provider cannot customize templates. Configure SMTP first; these local files do not configure hosted Auth automatically. Native callbacks remain to be configured/verified for `loan-development://auth/callback`, `loan-staging://auth/callback`, and production `loan://auth/callback`. The current typed-code flow does not depend on a redirect URL.

Client error monitoring currently uses an allowlist sanitizer, disables breadcrumbs/tracing/native crash envelopes, and has unit canaries. Native crash collection must remain disabled until its independent redaction path is verified. Production Sentry upload settings and a cloud canary check remain release prerequisites.

1. Replay all migrations on a clean local/test database; run `npm run db:test`. The current suite covers selected RLS/RPC regressions, not the full M2 concurrency/JWT matrix.
2. Apply the candidate migrations and Edge Functions to STAGING; run two-account/device E2E with synthetic data.
3. Record the target project reference and migration diff/dry-run before a remote write. Never infer the target solely from a cached CLI link.
4. Before production migration, verify backup and restore evidence, compatibility with installed app versions and a forward-fix plan. Prefer additive changes; do not edit applied migration history.
5. Build the intended profile, install the binary and prove its auth, invite, read/write and monitoring requests reach the intended environment.
6. Record commit SHA, build ID/version, app environment, non-secret project reference, migration head and test result in the progress report.

On Windows, `scripts/check-android-apk.ps1 -Apk <file.apk> -AppEnvironment staging -JavaExecutable <java.exe>` verifies the signature with Android build-tools, package, disabled backup, forbidden permissions and expected scheme. Use a working Java installation and Android SDK (`ANDROID_HOME`, or the default local SDK path). The script reads artifacts only; it does not install them or change machine execution policy. Passing it does not establish device, cloud or 16 KB runtime readiness. If the shell blocks local scripts, an explicitly scoped invocation such as `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/check-android-apk.ps1 ...` runs this reviewed script for that process without changing the machine policy.

## Acceptance checklist

- [ ] Owner accounts use MFA/recovery controls; production secrets are unavailable to untrusted PR jobs.
- [ ] Database/function ACL inventory includes PUBLIC/default privileges and exposed schemas; tests use real client roles.
- [ ] Secret scans cover repository history and release artifacts without printing findings verbatim.
- [ ] Log/crash/push canary tests prove private fields and invite/session tokens are excluded.
- [ ] Restore reapplies deletion/suppression records before user access or queued notifications resume.

- [ ] M0: development/preview mapping explicit; Android preview installs and uses only STAGING.
- [ ] M0: redirects/app links and credentials are isolated; local database replay works.
- [ ] M2: clean replay plus RLS/RPC/concurrency tests pass automatically.
- [ ] M4: deletion, notifications, monitoring and restore evidence exist.
- [ ] M5: production build rejects missing/mismatched configuration and uses only PRODUCTION.
- [ ] M5: real beta users have production privacy, backup and support protections.
- [ ] Before release: owner verifies cloud settings; actual values are never copied into documentation.

This document specifies the target operating process. Editing it does not configure EAS, deploy migrations or establish that the checklist has passed.
