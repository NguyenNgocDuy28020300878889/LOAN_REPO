# Đăng nhập LOAN bằng mã email

**Kiểm tra bước 4 — 23/09/2026:** ứng dụng vẫn giữ OTP làm phương án dự phòng, nhưng hosted build nay fail-closed: OTP chỉ hiện khi được bật rõ ràng và build gate yêu cầu xác nhận SMTP đã kiểm chứng. STAGING hiện giữ `EXPO_PUBLIC_EMAIL_OTP_READY=false`; chưa gửi email thật hoặc thay đổi Supabase SMTP.

Cập nhật: 16/09/2026. Gmail là địa chỉ nhận mã cho tài khoản LOAN; ứng dụng không tạo tài khoản Google và không yêu cầu mật khẩu Gmail.

Theo lựa chọn mới nhất, email OTP là phương án **dự phòng cho đăng nhập Google**, dùng cùng email tài khoản. Chưa bật gửi email cloud do thiếu SMTP; Google không tự giải quyết điều kiện này. Xem [Google và khôi phục tài khoản](GOOGLE_SIGN_IN.md).

## Luồng đã triển khai

1. Nhập địa chỉ email (bao gồm Gmail), chọn **Gửi mã xác nhận**.
2. Nhập mã 8 chữ số. Cùng một luồng dùng cho đăng ký và đăng nhập; chỉ có phiên truy cập dữ liệu sau khi máy chủ xác minh thành công.
3. Quay về lời mời đang mở hoặc danh sách khoản vay. Có đổi email, gửi lại sau 60 giây, thông báo mã sai/hết hạn và giới hạn tần suất.

Mã không được lưu trong local storage, URL hoặc log của ứng dụng. Supabase xác minh mã và cấp phiên; ứng dụng tiếp tục dùng cơ chế cách ly tài khoản, SecureStore native và RPC/RLS hiện có. Nút Google OAuth và trường mật khẩu không còn trên màn hình đăng nhập chính. Endpoint Auth cũ vẫn tồn tại ở Supabase; thay giao diện không có nghĩa đã vô hiệu hóa mọi phương thức mật khẩu ở backend. Luồng phục hồi cũ được giữ tương thích, không tự ý thay đổi tài khoản đang có.

## Local khác cloud

- Local dùng GoTrue/Postgres/Mailpit thật trên máy, không phải API mô phỏng. Email bị giữ trong Mailpit tại `http://127.0.0.1:54324`; **không gửi đến Gmail thật**. Màn hình Auth có thông báo này.
- Template `supabase/templates/email-otp.html` được dùng cho cả **Confirm signup** và **Magic Link**, hiển thị `{{ .Token }}`. Local cấu hình mã 8 chữ số, hết hạn 600 giây, vẫn bắt buộc xác minh email.
- Local để khoảng cách gửi email 1 giây phục vụ integration tests. Giao diện vẫn đợi 60 giây; hosted phải cấu hình giới hạn phía server ít nhất 60 giây. Đồng hồ ở client không thay thế giới hạn server.
- DEV và STAGING đã được khôi phục, có đủ 15 migration và đạt kiểm tra HTTPS/Auth/API cùng SQL regressions. Bản web riêng kết nối cloud ở cổng 8082/8083. Gửi mã Gmail còn chặn vì chưa có custom SMTP và Supabase không cho sửa template trên free tier dùng provider mặc định. Xem [trạng thái cloud](CLOUD_CONNECTION.md).

## Hoàn tất kết nối trực tuyến

1. Đã khôi phục cả DEV (`rwfmqthrpbkizcofullh`) và STAGING (`kircmwdkcdcozckrwfid`). Không tạo lại database.
2. Đã đối chiếu history, dry-run có rollback và áp dụng migration; SQL tests trên mỗi cloud đều đạt. Dữ liệu thật cần môi trường production riêng theo `ENVIRONMENTS.md`.
3. Cấu hình Custom SMTP trong Supabase Dashboard với địa chỉ gửi đã xác minh. Nhập SMTP secret trực tiếp trong Dashboard/secret store; không đưa vào chat, Git hoặc biến `EXPO_PUBLIC_*`. Xác minh domain gửi/SPF/DKIM theo nhà cung cấp.
4. Giữ OTP length 8 theo lựa chọn chủ ứng dụng. Hosted hiện đã bật confirmation, khoảng cách gửi 60 giây, expiry 3600 giây; chưa thay policy. Sau khi có SMTP, áp dụng template vào **Confirm signup** và **Magic Link**, ghi thời hạn đúng cấu hình thực tế. Rà soát quota/chống abuse trước khi mở đăng ký công khai.
5. Export lại app bằng URL/publishable key đúng môi trường; không dùng service-role key trong client. Kiểm tra template và cấu hình hosted riêng: file TOML local không tự áp dụng lên cloud.
6. Dùng hai hộp thư thật do chủ ứng dụng kiểm soát: nhận mã Gmail, sai mã/đã dùng/hết hạn, đăng xuất/đăng nhập lại, lời mời, tạo khoản vay và đối chiếu dữ liệu trên hai thiết bị. Sau đó mới ghi nhận nghiệm thu online.

Supabase SMTP mặc định bị giới hạn và không dành cho gửi đến người dùng tùy ý; cần SMTP riêng để phục vụ người dùng thật. Tham chiếu: [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Kiểm chứng

- `npm run test`: kiểm tra validation, không truyền mật khẩu, xác minh đúng địa chỉ, phải có session do server cấp, xử lý rate limit và không hiển thị lỗi nội bộ.
- `npm run test:otp:local`: đăng ký không mật khẩu, chưa xác minh không có session/quyền đọc, chặn sai mã/sai email/replay, đăng nhập lại giữ đúng tài khoản.
- `npm run test:auth:local`: xác minh email, persistence, quyền RPC và phục hồi tài khoản cũ.
- `npm run export:browser:local` rồi `npm run test:browser:local`: nhập mã từ Mailpit qua UI, kiểm tra sai mã và cooldown, sau đó chạy luồng tạo/tham gia/trả nợ/đăng xuất.

## Lỗi nút tạo khoản vay trong cửa sổ thử

Đã tái hiện: Playwright mặc định tự dismiss `window.confirm` nếu không có dialog listener, nên thao tác không gửi RPC. Khi xác nhận đúng, chỉ một RPC được gửi và mở phòng khoản vay thành công. Cửa sổ tương tác đã chuyển sang Chrome thông thường với profile thử riêng, không giữ kết nối automation và không có cờ `--no-sandbox`. Không thay đổi hay bỏ bước xác nhận giao dịch để chữa lỗi này.
