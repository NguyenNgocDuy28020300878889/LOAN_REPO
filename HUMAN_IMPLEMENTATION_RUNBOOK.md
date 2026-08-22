# Loan — Hướng dẫn triển khai cần người phụ trách

Tài liệu này gồm các thao tác cần quyền sở hữu tài khoản, credentials, thiết bị thật hoặc quyết định pháp lý/sản phẩm. Thực hiện theo thứ tự và ghi kết quả vào `BAO_CAO_TIEN_DO.md`.

Trước mỗi lần build beta, chạy:

```bash
cd app
npm run validate
```

## 1. Xác thực Supabase và xóa tài khoản

1. Trong Supabase DEV, bật Email/Password và Google provider.
2. Tạo Google OAuth client; cho phép callback URL của Supabase và `loan://auth/callback`.
3. Thử đăng nhập Email và Google trên thiết bị Android/iOS thật.
   - Apple Sign In được chủ động hoãn; chỉ cấu hình ở Phase phát hành iOS hoặc khi chính sách Apple bắt buộc.
4. Cùng người phụ trách privacy/pháp lý đọc `app/supabase/functions/delete-account/README.md`.
5. Chỉ deploy sau khi cách quản lý service-role đã được phê duyệt:

```bash
cd app
npx supabase functions deploy delete-account
```

6. Dùng một tài khoản thử nghiệm đã tạo loan chung và đã gửi hoặc xác nhận repayment: yêu cầu xóa trong Settings, gọi function, xác minh profile bị xóa, auth user bị xóa thành công và lịch sử chung còn lại với actor/creator vô danh.

## 2. Bảo mật và toàn vẹn dữ liệu

1. Chuẩn bị Supabase local bằng Docker hoặc một test project độc lập.
   - Lint local cần Docker: chạy `npx supabase start`, sau đó `npx supabase db lint`.
2. Thực hiện `app/supabase/tests/rls_phase_3.md`.
3. Dùng hai tài khoản trên hai thiết bị:
   - tạo loan → chia sẻ invite → đăng nhập → chấp nhận → cả hai cùng thấy một Loan Room `ACTIVE`;
   - gửi repayment → người còn lại confirm/dispute/cancel;
   - thử lại cùng idempotency key, tự confirm, overpayment, confirm đồng thời, invite hết hạn/đã dùng lại.
4. Replay toàn bộ migration trên STAGING trước khi migration production.
5. Quyết định invite link là capability link hay phải gắn với email/tài khoản người nhận.
6. Quyết định chính sách `REPAID → CLOSED`.

## 3. Push notification và giám sát

1. Cấu hình Expo push credentials cho Android/iOS.
2. Cấp một backend bảo vệ để đăng ký push token và scheduler nhắc ngày đến hạn.
3. Tôn trọng `notification_preferences` khi người dùng tắt push hoặc due reminder.
4. Thử trên thiết bị thật: opt-out, timezone, deduplication, deep link Loan Room đúng và delivery.
5. Cấu hình Sentry DSN/org/project/token; gửi lỗi thử đã loại PII và xác minh source map.

## 4. Build, beta và store

Build Android production `ead21548-3afb-4d13-a07b-8bae56fb615c` đã lỗi `EAS_BUILD_UNKNOWN_GRADLE_ERROR`. Trước khi thử lại, mở log trên EAS dashboard và ghi lỗi đầu tiên trong phase **Run gradlew** vào `BAO_CAO_TIEN_DO.md`.

```bash
cd app
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

1. Xác minh cả hai artifact cài được và mọi luồng chính hoạt động.
2. Hoàn tất khai báo mã hóa iOS và Apple Developer credentials.
3. Phê duyệt/cài app icon và splash asset riêng cho Loan; không phát hành với branding Expo mặc định.
4. Xuất bản URL Privacy Policy và Terms; hoàn thành biểu mẫu Apple Privacy và Google Data Safety.
   - Cùng người phụ trách pháp lý/sản phẩm chốt retention period, privacy contact và re-authentication trước khi xóa tài khoản.
5. Hoàn thành yêu cầu Android testing và thiết lập TestFlight.
6. Chỉ sau khi mọi beta gate Phase 8 pass mới chọn phần trăm rollout theo giai đoạn và người chịu trách nhiệm rollback.

## 5. Các quyết định sản phẩm

- Offline cache: cho phép lưu dữ liệu thiết bị không mã hóa hay bắt buộc encrypted storage?
- Chuyển tiếp invite: capability link hay invitation gắn với người nhận?
- Đóng loan: một participant hay cả hai cần đóng room sau khi trả đủ?
- Xác nhận tên `Loan` có thể dùng trên store/thị trường phát hành.
