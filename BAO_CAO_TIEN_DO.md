# Báo cáo tiến độ dự án — Loan

**Cập nhật:** 22/08/2026  
**Mục đích:** Theo dõi phần đã hoàn thành, bằng chứng kiểm tra và các việc cần người phụ trách thực hiện sau. Việc hoãn không được tính là hoàn thành.

**Hướng dẫn thao tác cần con người:** `HUMAN_IMPLEMENTATION_RUNBOOK.md`

## Tổng quan

| Phase | Trạng thái | Kết quả chính | Việc còn lại |
|---|---|---|---|
| 0 — Chốt sản phẩm | Hoàn tất có điều kiện | MVP, thuật ngữ, quy tắc miền | Kiểm tra tên Loan và khai báo mã hóa iOS |
| 1 — Kiểm chứng UX | Chờ người dùng thử | Prototype, kịch bản test | 5 role-direction test, 5 Language-Blind test |
| 2 — Nền tảng | Hoàn tất trong mã nguồn, build Android lỗi | Expo, CI, EAS, cấu hình môi trường | Lỗi Gradle EAS, iOS credentials, Sentry production |
| 3 — Dữ liệu & xác thực | Hoàn tất trong mã nguồn/DEV | Schema, RPC, RLS foundation, Auth | Google OAuth, RLS test, deletion worker |
| 4 — Tạo khoản vay & lời mời | Hoàn tất trong mã nguồn/DEV | Create, review, share, preview, accept/decline | E2E hai tài khoản, recipient-binding decision |
| 5 — Loan Room chung | Hoàn tất trong mã nguồn/DEV | Home, Room, Realtime, canonical reads | Chính sách offline cache, E2E hai thiết bị |
| 6 — Toàn vẹn trả nợ | Hoàn tất trong mã nguồn/DEV | RPC trả nợ, kiểm soát quyền, UI | E2E/concurrency, quy tắc đóng room |
| 7 — Sẵn sàng sản phẩm | Hoàn tất trong mã nguồn | Song ngữ, accessibility, privacy foundation | Push, Sentry, legal/privacy, E2E thật |
| 8 — Phát hành | Chuẩn bị phát hành | CI, README, beta checklist | Artifact cài được, store/legal/monitoring |

## Bằng chứng gần nhất

- `npm run validate` đã đạt: Prettier, ESLint, TypeScript, unit test và static web export.
- Có 11 unit tests đang pass; `app/dist/index.html` và 11 routes đã được tạo.
- Supabase DEV: local/remote khớp 11 migrations, gồm `20260822100000_account_deletion_history_retention.sql`.
- Android production build `ead21548-3afb-4d13-a07b-8bae56fb615c` và preview build nội bộ `2516cb39-4b1e-4716-8a7b-c9f4c9991f05` đều lỗi `EAS_BUILD_UNKNOWN_GRADLE_ERROR`; lỗi đã tái lập ở cả hai profile.
- Kiểm tra Expo Go trên Android cho thấy lỗi `Incompatible SDK version` với SDK 57. Dự án đã được hạ về Expo SDK 54 để kiểm thử bằng Expo Go; `expo-doctor` đạt 18/18, lint và TypeScript sạch, Vitest đạt 11/11. Cần quét QR lại sau khi khởi động Metro.

---

## Phase 0 — Chốt sản phẩm

### Đã hoàn thành

- Tên hiển thị: **Loan**.
- MVP là sổ ghi nhận chung cho một lender và một borrower; không xử lý thanh toán, không cho vay, không marketplace.
- Quy tắc minor-unit, idempotency, RLS, audit timeline và state machine đã được tài liệu hóa.
- Android/iOS application ID: `com.loanappmobiles.loanapp`; URL scheme: `loan`.

### Cần xác nhận

| Việc | Điều kiện hoàn tất |
|---|---|
| Tên/trademark/store availability | Đánh giá tên Loan tại thị trường phát hành |
| Mã hóa iOS | Xác nhận `ITSAppUsesNonExemptEncryption` đúng với chức năng app |

## Phase 1 — Kiểm chứng UX

### Đã hoàn thành

- Prototype: `prototype/index.html`.
- Kịch bản test: `PHASE_1_TEST_PLAN.md`.
- Luồng Create → Invite/Join → Loan Room → Repayment → Confirm đã có.

### Cần thực hiện với người dùng

| Việc | Điều kiện hoàn tất |
|---|---|
| 5 lượt role-direction test | Không có lỗi P0 về lender/borrower hoặc hướng tiền |
| 5 lượt Language-Blind test | Ít nhất 90% hoàn thành luồng chính không trợ giúp |
| Cập nhật UX theo bằng chứng | Xử lý các lỗi lặp lại từ ít nhất 2 người thử |

## Phase 2 — Nền tảng

### Đã hoàn thành

- Expo SDK 54, Expo Router, TypeScript strict, ESLint, Prettier, Vitest, GitHub Actions CI.
- TanStack Query, Zustand, validation, i18n, Supabase client theo môi trường và Sentry skeleton.
- EAS liên kết `@loanappmobiles-team/loanapp`; static web export đã kiểm tra.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Android build | Mở EAS dashboard của preview build `2516cb39-4b1e-4716-8a7b-c9f4c9991f05` hoặc production build cũ, lấy lỗi đầu tiên ở **Run gradlew** để sửa; hiện chưa có APK |
| iOS build | Có Apple Developer credentials, signing và EAS build `finished` |
| Sentry production | DSN/org/project/token, scrubbed event và source map hoạt động |
| Dependency audit | Theo dõi 12 moderate advisory Expo/xcode → uuid; chỉ nâng cấp khi có bản Expo tương thích |

## Phase 3 — Dữ liệu & xác thực

### Đã hoàn thành trên DEV

- Schema profiles, loans, members, invites, repayments, events, idempotency và notification preferences.
- RPC atomic/idempotent và RLS foundation cho dữ liệu tài chính.
- Email/mật khẩu và Google OAuth flow đã có trong app; Apple Sign In hoãn đến iOS release.
- Migration retention bảo toàn lịch sử chung, đồng thời ẩn danh actor/creator khi auth user bị xóa.
- Edge Function `supabase/functions/delete-account` đã có mã nguồn.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Google OAuth | Bật provider, tạo Google client, cấu hình callback/redirect và thử trên thiết bị thật |
| Ma trận RLS | Docker/local Supabase hoặc test project; chạy `supabase/tests/rls_phase_3.md` |
| Worker xóa tài khoản | Legal/privacy review, deploy Edge Function, test profile bị xóa và lịch sử chung vô danh còn lại |
| Staging | Replay migration từ đầu không drift |

## Phase 4 — Tạo khoản vay & lời mời

### Đã hoàn thành

- Token lời mời chỉ trả một lần, lưu SHA-256 hash, chặn hết hạn/đã dùng/thu hồi.
- Create screen Việt/Anh, validation, deep link `loan://invite/<token>`, preview và accept/decline.
- Người chưa đăng nhập quay lại đúng invite sau auth.
- Confirmation trước khi tạo invite hiển thị vai trò, số tiền, ngày vay và ngày đến hạn; người dùng có thể hủy.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| E2E hai tài khoản | A tạo → B nhận link → B chấp nhận → cả hai thấy loan `ACTIVE` |
| Test token abuse | Token hết hạn, dùng lại, thu hồi đều bị chặn |
| Chính sách lời mời | Chốt capability link hiện tại hoặc recipient-binding qua email/tài khoản |

## Phase 5 — Loan Room chung

### Đã hoàn thành

- Canonical Home/Loan Room chỉ trả dữ liệu cho accepted members.
- Balance chỉ tính repayment `CONFIRMED`; Home, Room, timeline và realtime cache invalidation đã có.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Chính sách offline cache | Chốt có được lưu dữ liệu tài chính không mã hóa hay bắt buộc encrypted storage |
| E2E hai thiết bị | Hai thiết bị hội tụ canonical data sau create/join/repayment |

## Phase 6 — Toàn vẹn trả nợ

### Đã hoàn thành

- Submit/confirm/dispute/cancel là RPC server-side atomic và idempotent.
- Chặn self-confirm, overpayment; balance chỉ đổi khi `CONFIRMED`; trả đủ chuyển `ACTIVE` sang `REPAID`.
- UI chỉ hiện Cancel cho người tạo, Confirm/Dispute cho người còn lại; không optimistic update balance.
- Form báo lỗi số tiền, tiền tệ và ngày trước RPC; server vẫn là lớp quyết định cuối.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| E2E/concurrency | Xác minh self-confirm, duplicate key, retry, timeout, overpayment, concurrent confirm, dispute/cancel |
| Đóng room | Chốt `REPAID → CLOSED`: một bên hay cả hai xác nhận |

## Phase 7 — Sẵn sàng sản phẩm

### Đã hoàn thành

- UI Việt/Anh; theo locale thiết bị, đổi thủ công trong Preferences và lưu `profiles.locale` sau đăng nhập.
- Tiền/ngày/giờ, trạng thái loan/repayment và timeline event được dịch.
- Accessibility labels, trạng thái không chỉ dựa vào màu, deep links, error/retry states.
- Notification preferences server-side; Settings không gọi RPC dữ liệu cá nhân khi chưa đăng nhập.
- Delete-account request, audit migration, privacy policy nội bộ và retention/anonymization foundation.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Push/reminder | Credentials, token backend, scheduler, timezone/dedup/opt-out test thật |
| Privacy/Terms | Legal review, URL công khai, retention/contact/re-auth trước xóa đã chốt |
| Sentry | Scrubbed event và source map pass |
| Security E2E | Ma trận RLS, two-device và concurrency có bằng chứng |

## Phase 8 — Phát hành

### Đã hoàn thành

- CI chạy `npm ci` và `npm run validate`.
- README, EAS profiles, beta checklist, báo cáo và runbook đã có.

### Cổng bắt buộc trước beta công khai

1. Android và iOS preview artifact cài được.
2. Invite/join, repayment integrity/concurrency và RLS E2E pass.
3. Worker xóa tài khoản deploy/test; privacy review pass.
4. Push opt-out, dedup, timezone và deep link pass.
5. Sentry có scrubbed test event.
6. Privacy Policy, Terms, App Store Privacy và Google Play Data Safety hoàn chỉnh.

### Các quyết định còn chờ

- Offline cache: không mã hóa hay encrypted storage?
- Invitation forwarding: capability link hay recipient-bound?
- Loan closure: một participant hay cả hai đóng room sau `REPAID`?
- Tên Loan có thể dùng ở thị trường phát hành không?
- Lỗi đầu tiên trong EAS **Run gradlew** là gì?
