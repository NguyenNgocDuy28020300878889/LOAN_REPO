# HTTPS App Links cho lời mời LOAN

Cập nhật 23/09/2026. Mã nguồn đã sẵn sàng tạo và nhận link dạng `https://<domain>/invite/<token>` nhưng chưa bật trên STAGING/production vì chưa có domain, DNS, hosting và fingerprint Play App Signing được xác nhận.

## Hành vi đã triển khai

- Khi `EXPO_PUBLIC_APP_LINK_ORIGIN` là một HTTPS origin hợp lệ, ứng dụng khai báo Android intent filter `autoVerify=true` chỉ cho đường dẫn `/invite/` và chia sẻ lời mời bằng origin đó.
- Khi biến này trống, DEV/STAGING tiếp tục chia sẻ custom scheme theo môi trường. Không tự thay một domain giả hoặc chưa được sở hữu.
- Luồng dán lời mời chấp nhận HTTPS chỉ khi origin khớp chính xác cấu hình, token đủ 64 ký tự hex và URL không có query/fragment. Custom scheme cũ vẫn hoạt động để chuyển tiếp an toàn.
- Production build bị từ chối nếu thiếu `EXPO_PUBLIC_APP_LINK_ORIGIN`. Origin có HTTP, port, path, query, fragment, credentials hoặc hostname không công khai cũng bị từ chối.
- Route web `/invite/<token>` đã tồn tại. Nếu app chưa cài, hosting của origin phải phục vụ web export/fallback cho route này để người nhận xem hướng dẫn và đăng nhập trên web; không redirect token sang domain khác.

## Hoàn tất khi có domain

1. Chọn domain HTTPS do chủ dự án kiểm soát và cấu hình `EXPO_PUBLIC_APP_LINK_ORIGIN` trong đúng EAS environment, ví dụ `https://app.example.com`. STAGING nên dùng host riêng để không trộn package/certificate production.
2. Lấy SHA-256 certificate fingerprint của bản EAS dùng kiểm thử. Khi phát hành qua Google Play App Signing, lấy thêm fingerprint của **App signing key certificate** trong Play Console; fingerprint upload key không thay thế fingerprint Play ký bản người dùng cài.
3. Tạo Digital Asset Links cục bộ, không đưa keystore vào repository:

```powershell
$env:EXPO_PUBLIC_APP_ENV='production'
$env:EXPO_PUBLIC_APP_LINK_ORIGIN='https://app.example.com'
$env:ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS='AA:BB:...:FF'
npm run generate:assetlinks
```

File được tạo tại `.local/app-links/production/.well-known/assetlinks.json`. Triển khai nội dung này đúng tại `https://app.example.com/.well-known/assetlinks.json`, trả `200`, `Content-Type: application/json`, không redirect.

4. Host web export trên cùng origin và bảo đảm truy cập trực tiếp `/invite/<token>` không trả 404. Thêm origin/callback web chính xác vào Supabase Auth; không dùng wildcard ở production.
5. Build APK/AAB mới vì intent filter là cấu hình native. Cài bản đã ký tương ứng với fingerprint trong `assetlinks.json`.
6. Kiểm tra trên Android:

```powershell
adb shell pm verify-app-links --re-verify com.loanappmobiles.loanapp
adb shell pm get-app-links com.loanappmobiles.loanapp
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://app.example.com/invite/<token>"
```

Thử cold start, app ở nền, app chưa cài, link hết hạn/thu hồi/đã dùng và đăng nhập Google rồi quay lại đúng lời mời. Kết quả custom scheme không thay cho kiểm chứng HTTPS App Links.

Đối chiếu: [Expo Android App Links](https://docs.expo.dev/linking/android-app-links/), [Android App Links](https://developer.android.com/training/app-links/about), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
