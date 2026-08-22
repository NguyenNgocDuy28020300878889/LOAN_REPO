# Phase 6 — Repayment Integrity

**Status:** Code complete — awaiting two-account integrity evidence and closure policy  
**Applied environment:** Supabase DEV `shared-loan-dev`

## Completed

- Migration `20260822083000_repayment_integrity_rpcs.sql` applied to DEV.
- Server-only, idempotent RPCs: submit, confirm, dispute and cancel repayment.
- Only accepted loan members may submit or decide a repayment.
- The proposing user cannot confirm or dispute their own repayment; only its author can cancel it while pending.
- Confirm locks the loan, computes balance from confirmed repayments, rejects overpayment and moves `ACTIVE` to `REPAID` exactly at the principal amount.
- Client TypeScript contracts are present for each RPC.
- Loan Room includes a dedicated repayment submission screen; no client-side balance update occurs after submit.
- Loan Room shows repayment history and gives only cancel to its author or confirm/dispute to the counterparty; successful decisions invalidate canonical cache entries.
- Repayment entry uses the room currency and converts decimal user input to validated minor units before its server command.
- Create/repayment screens reject invalid money input locally with a specific localized message before invoking financial RPCs; server-side checks remain authoritative.

## Remaining before Phase 6 closure

- Run two-account integrity tests: self-confirm denied, duplicate idempotency response, concurrent confirms, overpayment rejection, dispute/cancel behavior and timeout retry.
- Decide the `REPAID → CLOSED` user action and its dual-confirmation policy; this is not implicit in the current product brief.
