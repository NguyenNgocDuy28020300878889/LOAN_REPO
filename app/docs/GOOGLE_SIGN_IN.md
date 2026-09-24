# Đăng nhập Google và email dự phòng

**Kiểm tra bước 4 — 23/09/2026:** endpoint Auth DEV và STAGING tiếp tục xác nhận Google provider đang bật; yêu cầu authorize dùng PKCE S256 và chuyển đến Google với callback Supabase đúng từng project. Đây là kiểm tra read-only, không đăng nhập tài khoản Google thật. Regression mới giữ `/pending-invite/<uuid>` qua Google/OTP thay vì làm mất đích sau callback. Việc đưa Google consent screen từ Testing sang Production, branding/verification và thử tương tác trên Android vẫn cần tài khoản chủ dự án.

Cập nhật 16/09/2026. Google là lựa chọn chính; email OTP giữ **8 số**. LOAN không tạo tài khoản Gmail, không nhận hoặc lưu mật khẩu Google. Tài khoản LOAN được tạo khi đăng nhập thành công.

## Trạng thái

- Đã nối nút Google vào Supabase OAuth PKCE. Web chuyển cùng tab; Android/iOS dùng trình duyệt hệ thống và scheme riêng từng môi trường.
- DEV và STAGING: đã bật Google bằng Web OAuth client của project `loan-test-508813` do chủ dự án cung cấp. Đã đọc lại provider/callback sau cấu hình và kiểm tra endpoint OAuth thật chuyển đến Google đúng callback từng dự án. Giữ nguyên chính sách OTP/xác minh email; không in Client Secret.
- Bản web DEV/STAGING được build với `EXPO_PUBLIC_GOOGLE_AUTH_READY=true`. Môi trường chưa cấu hình (bao gồm local) vẫn mặc định `false` và khóa nút Google.
- Email OTP cloud vẫn chưa sẵn sàng do thiếu SMTP/template; việc bật Google không tự bật gửi email.
- Hosted build hiện mặc định tắt email OTP. Build gate từ chối `EXPO_PUBLIC_EMAIL_OTP_READY=true` nếu chưa có cờ nội bộ `EMAIL_OTP_SMTP_VERIFIED=true`; cờ xác nhận không thay thế test nhận email thật.
- Chưa xác nhận đăng nhập bằng tài khoản Google thật hoặc trên thiết bị Android.
- Đã kiểm tra Chrome trên hai bản web mới: bấm Google tạo yêu cầu PKCE đúng backend và chuyển đến Google với đúng callback. Không có Client Secret trong JavaScript export. Kết quả này chưa thay thế việc chủ tài khoản đăng nhập và xác nhận phiên thật.
- Nếu nút Google bị khóa khi chạy DEV từ mã nguồn, kiểm tra `.env`: cần `EXPO_PUBLIC_GOOGLE_AUTH_READY=true` với backend DEV trực tuyến, rồi khởi động lại Expo. Đã sửa cờ còn thiếu trên máy này; email giữ `EXPO_PUBLIC_EMAIL_OTP_READY=false`. Cổng 8081 là backend local chưa cấu hình Google; DEV trực tuyến dùng cổng 8082.

## Thiết lập nhanh, chưa cần mua tên miền

Mở [Google Auth Platform](https://console.cloud.google.com/auth/overview). Đăng nhập bằng tài khoản của chủ dự án; chủ tài khoản tự xử lý mật khẩu/2FA.

1. Tạo/chọn Google Cloud project cho LOAN. Cấu hình Branding với tên ứng dụng và email hỗ trợ thực tế của bạn. Không điền tên miền không sở hữu.
2. Chọn Audience phù hợp cho thử nghiệm, thêm tài khoản của bạn/người thử vào Test users nếu đang ở chế độ Testing.
3. Chỉ dùng scope `openid`, `email`, `profile`; không cần đọc Gmail, danh bạ hoặc Drive.
4. Tạo OAuth Client loại **Web application**. Cách nhanh cho DEV/STAGING: một client thử nghiệm có cả hai callback Supabase bên dưới; production sau này dùng client riêng. Có thể tách hai client ngay nếu muốn.
5. Authorized JavaScript origins: `http://127.0.0.1:8082`, `http://localhost:8082`, `http://127.0.0.1:8083`, `http://localhost:8083` tương ứng môi trường dùng client đó.
6. Authorized redirect URIs trên **Google Console**:

| Môi trường | Callback Google → Supabase                                  |
| ---------- | ----------------------------------------------------------- |
| DEV        | `https://rwfmqthrpbkizcofullh.supabase.co/auth/v1/callback` |
| STAGING    | `https://kircmwdkcdcozckrwfid.supabase.co/auth/v1/callback` |

7. Tải JSON của Web client, lưu `app/.local/google-oauth.json` (đã loại khỏi Git/EAS). Không gửi Client Secret trong chat, không đặt trong biến `EXPO_PUBLIC_*`.
8. Từ thư mục `app`, chạy bằng phiên Supabase CLI của chủ dự án:

```powershell
# Kiểm tra chỉ đọc cấu hình cloud; cập nhật cờ public cho bản preview
python scripts/configure-google-auth.py development
python scripts/configure-google-auth.py staging

# Chỉ chạy sau khi JSON thật có đầy đủ callback tương ứng
python scripts/configure-google-auth.py development --apply --client-json .local/google-oauth.json
python scripts/configure-google-auth.py staging --apply --client-json .local/google-oauth.json

node scripts/export-browser-cloud.mjs development
node scripts/export-browser-cloud.mjs staging
```

Script kiểm tra đúng project/organization/health và callback trong JSON trước khi áp dụng. Chỉ thay Google provider, Site URL và callback allow list; giữ nguyên OTP 8 số, thời hạn mã, xác minh email và chính sách mật khẩu. Không in bí mật hoặc toàn bộ phản hồi Auth. Dừng nếu allow list đang có URL ngoài kế hoạch để tránh xóa cấu hình khác.

Trong **Supabase** (khác callback ở Google Console), redirect allow list phải gồm chính xác:

| Môi trường | Web callback                                                                 | App callback                       |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| DEV        | `http://127.0.0.1:8082/auth/callback`, `http://localhost:8082/auth/callback` | `loan-development://auth/callback` |
| STAGING    | `http://127.0.0.1:8083/auth/callback`, `http://localhost:8083/auth/callback` | `loan-staging://auth/callback`     |

Không dùng wildcard hoặc callback chéo môi trường. Luồng native cần development build/preview cài trên máy, không dùng Expo Go cho callback scheme này. Chưa cấu hình Google cho backend local cổng 54321.

Với EAS/Android, đặt `EXPO_PUBLIC_GOOGLE_AUTH_READY=true` trong đúng môi trường build **sau khi** provider/callback đã được kiểm tra, rồi tạo và cài bản build mới. Script export web không thay biến EAS hoặc APK đã cài. Không bật cờ email OTP khi SMTP còn thiếu.

## Email dự phòng và quên mật khẩu

- Đã đăng nhập bằng Google: không cần xác minh lại bằng email để được dùng LOAN.
- Nếu không dùng được nút Google nhưng **vẫn mở được hộp thư**, có thể nhận OTP 8 số tới cùng email sau khi SMTP được thiết lập. Supabase xử lý liên kết danh tính theo email đã xác minh; cần kiểm tra user ID giữ nguyên trước khi mở cho người dùng thật.
- Nếu quên mật khẩu Google hoặc mất quyền vào Gmail, dùng [khôi phục tài khoản Google](https://accounts.google.com/signin/recovery). OTP gửi vào chính hộp thư đã mất không giải quyết được trường hợp này.
- Một email khác có thể tạo tài khoản LOAN khác; chưa có tính năng email khôi phục phụ hoặc tự chuyển dữ liệu giữa tài khoản.
- Luồng đặt lại mật khẩu LOAN cũ vẫn giữ cho tài khoản mật khẩu cũ. Không dùng nó để thay mật khẩu Google.

## Kiểm thử trước khi cho người dùng thử

1. Web DEV/STAGING: Google chọn tài khoản → quay lại đúng cổng → cùng user ID qua lần đăng nhập tiếp theo; tạo khoản vay trên backend đúng môi trường.
2. Mở lời mời khi chưa đăng nhập → Google → quay lại đúng lời mời, không lộ chi tiết trước đăng nhập.
3. Hủy/chặn quyền ở Google: không tạo phiên, có thể thử lại. Callback sai môi trường hoặc thiếu/expired flow bị chặn.
4. Android build riêng từng môi trường: trình duyệt quay về đúng app, thử cả lúc app ở nền/khởi động lại. Chưa có bằng chứng kiểm thử thiết bị thật.
5. Khi có SMTP: nhận mã 8 số thật; cùng email Google phải giữ cùng user ID và khoản vay. Kiểm tra sai mã, mã dùng lại, giới hạn gửi lại. Không bật `EXPO_PUBLIC_EMAIL_OTP_READY` chỉ vì Google đã hoạt động.
6. Trước production: domain/URL triển khai thực tế, consent screen/chính sách quyền riêng tư, thu hẹp callbacks, cấu hình ứng dụng riêng và kiểm tra khôi phục tài khoản.

Tài liệu gốc: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/).
