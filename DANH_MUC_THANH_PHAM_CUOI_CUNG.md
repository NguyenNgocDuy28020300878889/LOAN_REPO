# DANH MỤC ĐÓNG GÓI THÀNH PHẨM CUỐI CÙNG (FINAL DELIVERABLES) — DỰ ÁN LOAN

**Thời điểm hoàn tất đóng gói:** 26/09/2026  
**Trạng thái kiểm thử:** 
- Unit Tests: **24 test files / 107 tests PASS**
- TypeScript: **Strict mode 0 errors**
- Lint (ESLint): **0 errors / 0 warnings**
- Prettier: **All files formatted**
- Web Export: **17 routes static bundle thành công**
- Cloud Environments: **DEV, STAGING, PRODUCTION xác minh thành công**

---

## 1. Thành phẩm Ứng dụng Frontend & Mobile (App Package)

### 1.1. Mã nguồn & Cấu trúc Client (`/app`)
- **Framework & Core:** React Native 0.81.5 + Expo SDK 54, Expo Router v6, TypeScript 5.9 strict.
- **Quản lý trạng thái & dữ liệu:** TanStack Query v5 + Zustand v5, xử lý offline invalidation và refetch qua native `AppState`.
- **Đa ngôn ngữ & Tiêu chuẩn hiển thị:** Hỗ trợ đầy đủ tiếng Việt (`vi`) và tiếng Anh (`en`), chuẩn hóa hiển thị ngày tháng `DD/MM/YYYY`, định dạng tiền tệ VND với dấu chấm hàng nghìn (`1.000.000 đ`), parser minor units chống lỗi làm tròn.
- **Design System & A11y:** Bảng màu chuyên nghiệp, chế độ Dark/Light tự động theo hệ thống, typography Inter, đầy đủ accessibility labels, touch targets đạt chuẩn mobile.

### 1.2. Bản build Web & Artifacts
- **Web Export:** Tạo thành công 17 static routes tại thư mục `app/dist` sẵn sàng deploy lên Vercel / Cloudflare Pages / Nginx:
  - `/` (Home / Danh sách khoản vay)
  - `/auth` (Xác thực Google OAuth PKCE & Email OTP)
  - `/create` (Tạo khoản vay mới với xác nhận bảo mật)
  - `/loan/[id]` (Phòng khoản vay chung, timeline, đối soát số dư)
  - `/invite/[token]` & `/open-invite` (Tiếp nhận & xử lý lời mời tham gia)
  - `/pending-invite/[id]` (Quản lý lời mời đang chờ)
  - `/preferences` & `/settings` (Tùy chọn ngôn ngữ, thông báo, tài khoản)
  - `/privacy-policy` (Chính sách quyền riêng tư theo chuẩn Google Play)
  - `/terms` (Điều khoản sử dụng dịch vụ)
  - `/account-deletion` (Cổng xóa tài khoản tự phục vụ trực tiếp trên web)

### 1.3. Cấu hình Native & Android Play Store Ready
- **Cấu hình `app.config.js` & `eas.json`:**
  - Package ID: `com.loanappmobiles.loanapp` (Production) & `com.loanappmobiles.loanapp.staging` (Staging).
  - Target API: Hỗ trợ Android 12–15+ (chuẩn bị API 35/36).
  - Deep Linking & App Links: Cấu hình `loan.duyhaohan.id.vn` với intent filters cho mở link tự động.
  - Phân quyền tối giản (Least Privilege): Loại bỏ hoàn toàn các quyền truy cập nguy hiểm, không yêu cầu camera/danh bạ/bộ nhớ ngoài.
  - **Tối ưu hóa dung lượng (Đã áp dụng commit `97c2c2b` & `65ce941`):** Gỡ bỏ Reanimated, Worklets, Gesture Handler, Expo Image và cô lập `expo-dev-client` (loại bỏ thư viện quét mã Barcode MLKit nặng 19MB khỏi staging và production).
- **Các bản Build Cloud đang kích hoạt (Mới nhất 26/09/2026):**
  - **Bản APK Staging (VersionCode 11):** [EAS Build 47eae1b1](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/47eae1b1-1e00-4c03-a286-e6d8af539f6b) — File cài đặt độc lập kiểm thử nội bộ.
  - **Bản AAB Production (VersionCode 5):** [EAS Build 95c7c458](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/95c7c458-483d-4458-a267-0126797328c4) — Gói Android App Bundle chính thức nộp Google Play Console.

---

## 2. Thành phẩm Hạ tầng Backend & Database (Supabase PostgreSQL)

### 2.1. Chuỗi Migration có thể Rollback (`app/supabase/migrations/`)
Dự án bao gồm chuỗi 27 migrations đã kiểm chứng tính toàn vẹn:
1. `20260901000000_init_schema.sql`: Khởi tạo bảng core (`profiles`, `loans`, `loan_participants`, `repayments`, `audit_logs`).
2. `20260902000000_rls_policies.sql`: Thiết lập Row Level Security nghiêm ngặt, chặn hoàn toàn truy cập ẩn danh (anonymous access).
3. `20260903000000_atomic_rpcs.sql`: Các hàm xử lý giao dịch tài chính nguyên tử (`submit_repayment`, `confirm_repayment`, `dispute_repayment`, `cancel_repayment`).
4. `20260910000000_push_notifications.sql`: Bảng tokens thiết bị, preferences và hàng đợi push notifications.
5. `20260915000000_auth_hardening.sql`: Ràng buộc PKCE, xác thực phiên thiết bị, session isolation.
6. `20260923090000_create_loan_contract.sql`: Hàm hợp đồng tạo khoản vay duy nhất, chuẩn hóa email người nhận, bảo vệ idempotent receipt.
7. `20260923120000_invite_lifecycle.sql`: Quản lý vòng đời lời mời (thu hồi, hết hạn, cấp lại, chống bypass).
8. `20260924090000_account_deletion_request_safety.sql` đến `20260925120000_account_deletion_audit_retention.sql`: Bộ 5 migrations hoàn thiện cơ chế xóa tài khoản an toàn, rào chắn giao dịch DISPUTED/ACTIVE, làm sạch nội dung cá nhân (content scrub) và lưu vết kiểm toán (audit retention).

### 2.2. Edge Functions Serverless (`app/supabase/functions/`)
- `delete-account`: Xử lý luồng xóa người dùng qua Auth Admin API, kích hoạt transaction xóa dữ liệu có điều kiện, cascade và scrub dữ liệu PII.
- `reconcile-account-deletions`: Cơ chế phục hồi các tác vụ xóa bị gián đoạn hoặc kẹt trạng thái PROCESSING.
- `push-worker`: Worker định kỳ gửi thông báo nhắc hạn qua Expo Push API.

### 2.3. Trạng thái Môi trường Backend
Đã xác minh qua script `check-cloud-connections.mjs`:
- **DEV:** `https://xbbjkyfscjebwczzocbe.supabase.co` — PASS
- **STAGING:** `https://bcfefyovfuhdflkdfqhh.supabase.co` — PASS
- **PRODUCTION:** `https://mubugfaygqfswqffuvfe.supabase.co` — PASS

---

## 3. Thành phẩm Pháp lý & Hồ sơ Phát hành Google Play (`app/docs/`)

Bộ hồ sơ hoàn chỉnh phục vụ xét duyệt Google Play và pháp chế:
1. **[PRIVACY_POLICY.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/PRIVACY_POLICY.md):** 
   - Minh bạch mục đích thu thập (định danh tài khoản, đồng bộ phòng vay, gửi thông báo).
   - Liệt kê các dịch vụ bên thứ ba: Supabase (Auth/DB), Sentry (Crash reporting có PII scrubbing), Expo (Push Service).
   - Cam kết không bán dữ liệu, không chia sẻ cho bên thứ ba vì mục đích quảng cáo.
2. **[TERMS_OF_SERVICE.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/TERMS_OF_SERVICE.md):**
   - Định vị ứng dụng: Công cụ ghi chép và đối soát tài chính cá nhân ngang hàng.
   - Tuyên bố miễn trừ: Ứng dụng không phải là tổ chức tín dụng, không cho vay trực tiếp, không cung cấp dịch vụ cầm đồ hay tài chính bất hợp pháp.
3. **[ACCOUNT_DELETION.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/ACCOUNT_DELETION.md):**
   - Hướng dẫn xóa tài khoản trong ứng dụng và qua web độc lập (`/account-deletion`).
   - Giải trình cơ chế lưu giữ dữ liệu kế toán/kiểm toán ẩn danh (Anonymized Audit Retention) tuân thủ chính sách Google Play Data Safety.
4. **[DATA_SAFETY.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/DATA_SAFETY.md):**
   - Bảng kê khai chi tiết từng trường dữ liệu phục vụ điền form Data Safety trên Google Play Console (Personal Info, Financial Info, App Info & Performance).
5. **[GOOGLE_PLAY_STORE_LISTING.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/GOOGLE_PLAY_STORE_LISTING.md):**
   - Tên ứng dụng, mô tả ngắn (Short description: tối đa 80 ký tự), mô tả chi tiết (Full description).
   - Thông tin tài khoản kiểm thử cho Reviewer (App Access Details) gồm 2 vai trò: Chủ khoản vay (Lender) và Người đi vay (Borrower).
   - Quy cách hình ảnh và Feature Graphic (1024 × 500) cùng bộ chụp màn hình giao diện.
6. **[PRODUCTION_OPERATIONS.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/PRODUCTION_OPERATIONS.md):**
   - Sổ tay vận hành hệ thống: Giám sát uptime, backup & restore định kỳ, quy trình ứng cứu sự cố và cơ chế Kill-Switch.

---

## 4. Kế hoạch & Tài liệu Báo cáo Tổng thể (Project Root)

- **[BAO_CAO_TIEN_DO.md](file:///c:/Users/PC/Desktop/LOAN/BAO_CAO_TIEN_DO.md):** Lịch sử tiến độ dự án từ Phase 0 đến Phase 8, chi tiết kết quả từng bản build APK và nghiệm thu thực địa.
- **[HUMAN_IMPLEMENTATION_RUNBOOK.md](file:///c:/Users/PC/Desktop/LOAN/HUMAN_IMPLEMENTATION_RUNBOOK.md):** Hướng dẫn từng bước con người thực hiện (thiết lập Google OAuth Console, Google Play Console, Supabase Project Production, Domain DNS).
- **[KE_HOACH_RA_MAT_ANDROID.md](file:///c:/Users/PC/Desktop/LOAN/KE_HOACH_RA_MAT_ANDROID.md):** Kế hoạch chi tiết từ Closed Testing (12–20 testers) đến Open Testing và Production Rollout.
- **[KE_HOACH_BAO_MAT.md](file:///c:/Users/PC/Desktop/LOAN/KE_HOACH_BAO_MAT.md):** Báo cáo kiến trúc bảo mật nhiều lớp: Auth PKCE, Session Boundary, RLS, Atomic Transaction, Data Sanitization.
- **[app/docs/GOOGLE_PLAY_EXECUTION_PLAN.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/GOOGLE_PLAY_EXECUTION_PLAN.md):** Kế hoạch triển khai 8 bước chuẩn bị phát hành Google Play.
- **[app/docs/GOOGLE_PLAY_REMEDIATION_PLAN_5_8.md](file:///c:/Users/PC/Desktop/LOAN/app/docs/GOOGLE_PLAY_REMEDIATION_PLAN_5_8.md):** Kế hoạch khắc phục và hoàn tất các điều kiện tiên quyết trước khi nộp xét duyệt.

---

## 5. Hướng dẫn các bước tiếp theo dành cho Người quản trị (Actionable Checklist)

1. **Khóa ký Google Play App Signing:** Cập nhật fingerprint SHA-256 thực tế từ Google Play Console vào `app/public/.well-known/assetlinks.json` để kích hoạt hoàn chỉnh Android App Links.
2. **Triển khai Edge Function Production:** Chạy lệnh `supabase functions deploy delete-account --project-ref <prod-ref>` và `supabase functions deploy reconcile-account-deletions --project-ref <prod-ref>`.
3. **Cấu hình SMTP:** Kích hoạt SMTP (Resend / SendGrid / Postmark) trên Supabase Production nếu muốn mở lại kênh đăng nhập dự phòng Email OTP.
4. **Tổ chức Closed Testing:** Đưa bản build AAB lên Google Play Console Closed Testing track với danh sách 12+ testers tham gia tối thiểu 14 ngày trước khi gửi Open Testing / Production.
