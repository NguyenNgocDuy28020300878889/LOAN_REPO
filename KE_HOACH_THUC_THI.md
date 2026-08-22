# Kế hoạch thực thi MVP — Loan

> Kế hoạch chủ đạo để theo dõi xuyên suốt quá trình xây dựng. Chỉ bắt đầu một bước khi các phụ thuộc của nó đã đạt tiêu chí hoàn tất.

**Tên sản phẩm đã chốt:** Loan

## 0. Product lock — Hoàn tất có điều kiện

- Chuẩn hóa product brief; package IDs được hoãn đến trước store build/phát hành.
- Hoàn thiện glossary, user stories, state-transition rules.
- Chốt Definition of Done cho mọi financial event.

**Hoàn tất khi:** không còn điểm mơ hồ về vai trò lender/borrower, trạng thái loan, quy tắc repayment và quyền xác nhận.

## 1. UX validation — Chờ test người dùng

- Low-fi flow: Create → Invite/Join → Loan Room → Repayment.
- Language-Blind Test và role-direction test.

**Hoàn tất khi:** người thử xác định đúng dòng tiền và vai trò mà không cần tutorial dài.

## 2. App foundation — Đang thực hiện

- Expo Router + TypeScript strict.
- Lint, unit test, CI; môi trường DEV/STAGING/PROD.
- i18n skeleton và error monitoring.

**Hoàn tất khi:** build Android/iOS/web route skeleton và CI đều chạy.

## 3. Secure backend

- Supabase migrations, enums, constraints và indexes.
- RLS, RPC atomic/idempotent, semantic error codes.
- RLS attacker tests và concurrency tests.

**Hoàn tất khi:** không thể đọc/ghi chéo dữ liệu và DB tái tạo được hoàn toàn từ migrations.

## 4. Core loan lifecycle

- Auth/Profile, Create Loan, secure invite, accept/decline.
- Kích hoạt Shared Loan Room.

**Hoàn tất khi:** hai tài khoản có thể tạo → tham gia → cùng thấy một khoản ACTIVE chính xác.

## 5. Shared truth

- Home, Loan Room, timeline, realtime invalidation, offline read cache.
- Balance chỉ tính từ repayment `CONFIRMED`.

**Hoàn tất khi:** hai thiết bị hội tụ cùng principal, due date, status, balance và timeline.

## 6. Repayment integrity

- Submit, confirm, dispute, cancel; partial/full repayment và REPAID/CLOSED.
- Chống overpayment; test retry, timeout và thao tác đồng thời.

**Hoàn tất khi:** không thể tạo balance khác nhau hoặc tự xác nhận repayment của chính mình.

## 7. Product readiness

- Push/reminder/deep link; i18n/RTL/accessibility.
- Privacy, account deletion, backup/restore, security hardening, Maestro E2E và beta.

**Hoàn tất khi:** toàn bộ quality gates UX, integrity và security đạt trước public beta.

## 8. Release & learn

- Staged rollout và monitoring P0/P1.
- Theo dõi activation, invite conversion và retention.

**Hoàn tất khi:** MVP vận hành ổn định; chỉ xét P1 khi retention xác nhận nhu cầu.

## Nguyên tắc bám kế hoạch

1. Luôn thực hiện bước chưa hoàn thành đầu tiên.
2. Financial commands phải do server xác nhận; không optimistic-update số dư.
3. Mọi thay đổi schema đi qua migration và kiểm thử RLS.
4. Không thêm P1/P2 khi P0 và quality gates chưa đạt.
