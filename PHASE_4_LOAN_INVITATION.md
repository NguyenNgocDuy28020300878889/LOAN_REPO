# Phase 4 — Loan Creation & Invitation

**Status:** Code complete — awaiting external verification and product decision  
**Applied environment:** Supabase DEV `shared-loan-dev`

## Completed

- Migration `20260822063132_loan_invite_rpcs.sql` applied to DEV.
- `create_loan`, `accept_loan_invite`, and `decline_loan_invite` RPCs are atomic and require an authenticated caller.
- Invite tokens are generated server-side, shown only in the create response, and persisted only as SHA-256 hashes.
- Expired, revoked, reused, invalid, and mismatched invitation states are rejected.
- Commands use a caller-scoped idempotency UUID so a retry returns the original response.
- Expo client has typed RPC contracts, Zod validation, and an EN/VI create-loan mobile screen.
- Create flow presents a native confirmation with the user's role, formatted amount, loan date and due date before it invokes the invite RPC.
- `loan://invite/<token>` opens a preview screen before the accept/decline action.
- Migration `20260822072000_invite_preview_rpc.sql` is applied to DEV.
- The app contains Email/Password and Google Auth entry screens to enable the two-account test once providers are configured.
- If an unauthenticated invitee starts an action, Auth receives a safe in-app return path and returns to that same invite after sign-in.

## Remaining before Phase 4 closure

- Add two-account E2E coverage: Account A creates, Account B accepts, both observe the same `ACTIVE` loan.
- Test invite replay, expiry, and revocation on a dedicated test environment.
- Decide whether an invite remains a capability link (current behavior) or must be bound to a recipient email/account. Recipient binding requires an additional product flow and migration.
- Complete Phase 3 deferred gates: RLS matrix, Google OAuth dashboard configuration, and migration replay on staging.

## Verification performed

```text
npm run typecheck      PASS
npm run test           PASS (3 tests)
npm run lint           PASS
npm run format:check   PASS
npx supabase migration list
  20260822053803 local = remote
  20260822062823 local = remote
  20260822063132 local = remote
```
