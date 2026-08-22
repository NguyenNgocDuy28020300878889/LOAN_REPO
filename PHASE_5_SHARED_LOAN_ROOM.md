# Phase 5 — Shared Loan Room

**Status:** Code complete — awaiting storage decision and two-device verification  
**Applied environment:** Supabase DEV `shared-loan-dev`

## Completed

- Migration `20260822074000_shared_loan_room_read_rpcs.sql` applied to DEV.
- `get_my_loans()` returns only loans where the caller is an accepted member.
- `get_loan_room(loan_id)` denies non-members and returns canonical terms, members and ordered timeline.
- Both summary and room balance use only repayments with status `CONFIRMED`.
- Home list, dedicated create screen, and Loan Room detail route use TanStack Query against the canonical RPCs.
- Realtime publication and cache invalidation cover loans, members, repayments and timeline events.

## Remaining before Phase 5 closure

- Add persistent offline read cache after deciding encryption/storage policy.
- Run two-device convergence test after the Phase 4 two-account path is configured.

## Human/product decision deferred

- Offline read cache can contain loan amounts, dates and participant names. Confirm whether the MVP may persist this data unencrypted on device, or whether it must use an encrypted-storage solution. This determines the package and platform-security implementation.
