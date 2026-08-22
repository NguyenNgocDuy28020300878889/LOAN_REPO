# Phase 3 — Database & Auth

**Trạng thái:** Đang thực hiện  
**Môi trường áp dụng:** Supabase DEV `shared-loan-dev`

## Đã hoàn thành

- [x] Supabase CLI liên kết với DEV project.
- [x] Migration `20260822053803_initial_schema.sql` đã áp dụng DEV.
- [x] Tạo `profiles`, `loans`, `loan_members`, `loan_invites`, `repayments`, `loan_events`.
- [x] Money lưu bằng `bigint` minor units; currency/date/role/status constraints.
- [x] Profile bootstrap trigger từ `auth.users`.
- [x] RLS read isolation nền tảng cho profiles/loans/members/repayments/events.
- [x] Direct financial writes bị revoke khỏi `authenticated`; Phase 4 sẽ chỉ dùng RPC security-definer.
- [x] Chốt Auth scope: Email/Password + Google OAuth; Apple Sign In hoãn.
- [x] Chốt policy account deletion: xóa/ẩn danh PII, giữ shared financial audit history.
- [x] i18n foundation hỗ trợ English và Vietnamese.
- [x] Tạo idempotency key foundation và account-deletion request workflow trên DEV.
- [x] App-side session bootstrap, Email/Password service và Google OAuth entry point.

## Còn lại trước khi đóng Phase 3

- [x] Tạo RPC/idempotency foundation cho commands Phase 4/6; migration `20260822063132_loan_invite_rpcs.sql` đã áp dụng DEV.
- [ ] Chạy RLS test matrix trên local/test project: outsider access, direct-write bypass, profile visibility và deletion request.
- [ ] Google OAuth provider configuration trong Supabase/Google Cloud và app-side profile/session bootstrap.
- [ ] Account-deletion Edge Function + migration/RPC hỗ trợ ẩn danh PII.
- [ ] Kiểm tra migration từ đầu trên local/staging trước Phase 4.

## Không làm ở Phase 3

- Không tạo principal/currency update flow hoặc repayment write trực tiếp từ client.
- Không áp dụng migration sang staging/production cho tới khi RLS tests pass.
